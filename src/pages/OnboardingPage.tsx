import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import BrandLogo from "@/components/BrandLogo";
import { instantiateTopics, type SyllabusTopic } from "@/lib/syllabusTrack";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_PROMPTS = [
  "I want an A* in A-level further maths",
  "Help me prepare for STEP",
  "I'm studying physics at university",
];

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey, I'm Cortexed. Tell me what you want to master and I'll build your personal learning track." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [trackCreated, setTrackCreated] = useState(false);
  const [buildStatus, setBuildStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Fetch the syllabus tree for this goal.
   *
   * The multi-pass generation that used to live here (skeleton → parallel expand → grain refine, all
   * driven from the browser) now runs inside the author-syllabus-tree edge function. That is not
   * tidying: the tree is cached GLOBALLY, and the cache write has to be a service-role write, or any
   * client could replace the syllabus served to every future student on the same goal. Moving it also
   * means a student whose goal is already cached gets their track instantly instead of paying for a
   * full generation run. See docs/syllabus-tree-layer.md.
   *
   * Returns null on any failure; the caller then falls back to the director's own draft topics.
   */
  const fetchSyllabusTree = async (
    meta: { goal: string; subject: string; level?: string; examBoard?: string },
    conversation: Message[],
  ): Promise<{ topics: SyllabusTopic[]; treeId: string | null; optionalUnits: string[] } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("author-syllabus-tree", {
        body: {
          subject: meta.subject,
          level: meta.level ?? null,
          board: meta.examBoard ?? null,
          goal: meta.goal,
          // The conversation is forwarded only so the spec resolver can read the student's own words
          // to work out which board/exam is actually meant.
          messages: conversation.map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error || !data?.ok) {
        console.error("syllabus tree authoring failed:", error || data?.errors);
        return null;
      }
      const topics = Array.isArray(data.tree?.topics) ? (data.tree.topics as SyllabusTopic[]) : [];
      if (topics.length === 0) return null;
      const optionalUnits = Array.isArray(data.tree?.optionalUnits) ? (data.tree.optionalUnits as string[]) : [];
      return { topics, treeId: data.treeId ?? null, optionalUnits };
    } catch (e) {
      console.error("syllabus tree request failed:", e);
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !user) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await supabase.functions.invoke("jarvis-director", {
        body: { messages: newMessages, userId: user.id, mode: "onboarding" },
      });

      if (resp.error) throw new Error(resp.error.message);
      const data = resp.data;

      if (data.track) {
        setBuildStatus("Mapping the full syllabus…");

        const userGoal = newMessages.filter((m) => m.role === "user").map((m) => m.content).join(" | ");
        const authored = await fetchSyllabusTree(
          {
            goal: userGoal,
            subject: data.track.subject,
            level: data.track.level,
            examBoard: data.track.exam_board,
          },
          newMessages,
        );

        // Fallback: the director already returned a draft tree alongside the track metadata. It is
        // coarser than an authored one, but a usable track always beats no track.
        const finalTopics: SyllabusTopic[] = authored?.topics
          ?? (data.track.topics || []).map((t: { title: string; subtopics: string[] }) => ({
            title: t.title,
            subtopics: Array.isArray(t.subtopics) && t.subtopics.length ? t.subtopics : [t.title],
          }));

        // Both the authored tree and the director's draft can come back empty. Creating the track
        // anyway would leave the student permanently onboarded onto a track with no topics — and
        // because `onboarding_complete` is set just below, they would never be offered this flow
        // again. Failing here routes into the catch and lets them retry, which is recoverable.
        if (finalTopics.length === 0) {
          throw new Error("no syllabus could be built for this goal");
        }

        const { data: track, error: trackErr } = await (supabase.from("learning_tracks" as never) as any).insert({
          user_id: user.id,
          title: data.track.title,
          subject: data.track.subject,
          emoji: data.track.emoji || "📚",
          exam_board: data.track.exam_board,
          level: data.track.level,
          exam_date: data.track.exam_date,
          // Provenance only — the track is a COPY of the tree at this moment, never a live view of
          // it, so re-authoring a tree never changes a track under the student who owns it.
          //
          // Spread conditionally rather than sending an explicit null: the frontend auto-deploys on
          // push while the migration that adds this column has to be run separately through
          // Lovable's chat, so there is a real window where the column does not exist yet. Naming it
          // unconditionally would make EVERY track insert fail during that window; omitting it when
          // there is nothing to record keeps onboarding working until the migration lands.
          ...(authored?.treeId ? { syllabus_tree_id: authored.treeId } : {}),
          // Which elective options this syllabus has, captured once here rather than read live from
          // the tree later (see available_options's own migration comment) — empty when the tree
          // authoring fell back to the director's draft topics, which never carries this field.
          ...(authored?.optionalUnits?.length ? { available_options: authored.optionalUnits } : {}),
        }).select().single();

        // A failed track insert used to fall through to `onboarding_complete: true` below, which
        // stranded the student: onboarded, no track, and no way back into this flow to retry.
        if (trackErr || !track) {
          throw new Error(trackErr?.message || "could not create the track");
        }
        await instantiateTopics(track.id, finalTopics);

        await supabase.from("profiles").update({ onboarding_complete: true }).eq("user_id", user.id);
        await refreshProfile();

        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
        setTrackCreated(true);
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I hit an error. Please try again." }]);
    } finally {
      setIsLoading(false);
      setBuildStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <BrandLogo className="text-xl" />
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border text-card-foreground rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                {buildStatus && <span className="text-xs text-muted-foreground">{buildStatus}</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Example prompts */}
        {messages.length <= 2 && !trackCreated && (
          <div className="flex flex-wrap gap-2 mb-4">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        {!trackCreated && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Tell Cortexed what you want to learn…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-hidden"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}

        {trackCreated && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}
