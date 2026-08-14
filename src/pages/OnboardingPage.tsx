import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, LayoutGrid, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import BrandLogo from "@/components/BrandLogo";
import { instantiateTopics, type SyllabusTopic } from "@/lib/syllabusTrack";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SubjectIcon } from "@/lib/subjectIcons";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Set when this message is offering a premade-track match (see checkPopularMatch) — renders two
   *  inline buttons instead of just text, and is cleared once the student picks either one. */
  recommendation?: { entry: PopularTrack; directorTrack: any; directorMessage: string };
}

const EXAMPLE_PROMPTS = [
  "I want an A* in A-level further maths",
  "Help me prepare for STEP",
  "I'm studying physics at university",
];

type PopularTrack = { title: string; subject: string; level: string; examBoard: string };

/**
 * One-click catalog for the syllabuses this app already knows how to author well — the identities
 * discussed as the first seeding priority. Picking one skips jarvis-director's freeform conversation
 * entirely and calls author-syllabus-tree directly with a known subject/level/board: identical
 * authoring path either way (skeleton → expand → background grounding), the only difference is not
 * making the student describe a goal we already know precisely. A cache hit here is instant; a miss
 * still pays the same fast-tree cost the chat path would, and warms the cache for the next student on
 * the same entry either way.
 *
 * Icons come from the real subject-icon system (lib/subjectIcons.tsx — lucide icons, not emoji), the
 * same one TrackOverview.tsx already uses, rather than a one-off emoji per entry.
 */
const POPULAR_TRACKS: PopularTrack[] = [
  { title: "AQA A-Level Physics", subject: "Physics", level: "A-Level", examBoard: "AQA" },
  { title: "AQA A-Level Mathematics", subject: "Mathematics", level: "A-Level", examBoard: "AQA" },
  { title: "AQA A-Level Further Mathematics", subject: "Further Mathematics", level: "A-Level", examBoard: "AQA" },
  { title: "Edexcel A-Level Mathematics", subject: "Mathematics", level: "A-Level", examBoard: "Edexcel" },
  { title: "Edexcel A-Level Physics", subject: "Physics", level: "A-Level", examBoard: "Edexcel" },
  { title: "Edexcel A-Level Further Mathematics", subject: "Further Mathematics", level: "A-Level", examBoard: "Edexcel" },
  { title: "OCR A-Level Mathematics", subject: "Mathematics", level: "A-Level", examBoard: "OCR" },
  { title: "OCR A-Level Physics", subject: "Physics", level: "A-Level", examBoard: "OCR" },
  { title: "TMUA", subject: "Mathematics", level: "Admissions test", examBoard: "TMUA" },
  { title: "ESAT", subject: "Science", level: "Admissions test", examBoard: "ESAT" },
  { title: "BMO1", subject: "Mathematics", level: "Olympiad", examBoard: "BMO" },
  { title: "BPhO Round 1", subject: "Physics", level: "Olympiad", examBoard: "BPhO" },
];

const norm = (s: string | null | undefined) => (s || "").toLowerCase().trim();

/** Does the director's parsed subject/level/board match a catalog entry we already have prebuilt? */
function findPopularMatch(track: { subject?: string; level?: string; exam_board?: string }): PopularTrack | null {
  return POPULAR_TRACKS.find((p) =>
    norm(p.subject) === norm(track.subject) &&
    norm(p.level) === norm(track.level) &&
    norm(p.examBoard) === norm(track.exam_board),
  ) ?? null;
}

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

  /**
   * Shared by both entry points: the chat flow (director-parsed goal, with a director-draft fallback
   * if authoring comes back empty) and the one-click popular-track flow (a known identity, no
   * fallback needed since the identity is already precise). Builds the syllabus tree, creates the
   * track row, and instantiates its topics.
   */
  const buildAndCreateTrack = async (
    meta: { title: string; subject: string; level?: string | null; examBoard?: string | null; emoji?: string; examDate?: string | null; goal?: string },
    conversation: Message[],
    fallbackTopics: SyllabusTopic[] = [],
  ): Promise<boolean> => {
    if (!user) return false;

    const authored = await fetchSyllabusTree(
      {
        goal: meta.goal ?? meta.title,
        subject: meta.subject,
        level: meta.level ?? undefined,
        examBoard: meta.examBoard ?? undefined,
      },
      conversation,
    );

    // Fallback (chat path only): the director already returned a draft tree alongside the track
    // metadata. It is coarser than an authored one, but a usable track always beats no track. The
    // one-click path has no such fallback — a known identity that fails to author should surface as
    // an error, not silently produce nothing.
    const finalTopics: SyllabusTopic[] = authored?.topics ?? fallbackTopics;
    if (finalTopics.length === 0) return false;

    const { data: track, error: trackErr } = await (supabase.from("learning_tracks" as never) as any).insert({
      user_id: user.id,
      title: meta.title,
      subject: meta.subject,
      // No 📚 default: track identity is drawn by lib/subjectIcons.tsx (lucide glyphs, keyed off
      // subject), and nothing renders this column any more — a hardcoded emoji was dead data.
      emoji: meta.emoji || null,
      exam_board: meta.examBoard ?? null,
      level: meta.level ?? null,
      exam_date: meta.examDate ?? null,
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
    if (trackErr || !track) return false;

    await instantiateTopics(track.id, finalTopics);
    await supabase.from("profiles").update({ onboarding_complete: true }).eq("user_id", user.id);
    await refreshProfile();
    return true;
  };

  /** The actual custom build, factored out so both "no match found" and "student declined the
   *  premade recommendation" paths can call the same thing. */
  const buildFromDirectorTrack = async (directorTrack: any, directorMessage: string, conversation: Message[]) => {
    setBuildStatus("Mapping the full syllabus…");
    const userGoal = conversation.filter((m) => m.role === "user").map((m) => m.content).join(" | ");
    const fallbackTopics: SyllabusTopic[] = (directorTrack.topics || []).map((t: { title: string; subtopics: string[] }) => ({
      title: t.title,
      subtopics: Array.isArray(t.subtopics) && t.subtopics.length ? t.subtopics : [t.title],
    }));

    const ok = await buildAndCreateTrack(
      {
        title: directorTrack.title,
        subject: directorTrack.subject,
        level: directorTrack.level,
        examBoard: directorTrack.exam_board,
        emoji: directorTrack.emoji,
        examDate: directorTrack.exam_date,
        goal: userGoal,
      },
      conversation,
      fallbackTopics,
    );
    if (!ok) throw new Error("no syllabus could be built for this goal");

    setMessages((prev) => [...prev, { role: "assistant", content: directorMessage }]);
    setTrackCreated(true);
    setTimeout(() => navigate("/dashboard"), 2000);
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
        // Before generating a custom tree, check whether what the student described actually matches
        // one of the premade identities we already have — no point making them wait for a fresh build
        // (and no point them getting a slightly-different custom tree) when an audited one already
        // exists for exactly this subject/level/board. Offer the choice rather than deciding for them:
        // some students want the fast, verified premade track; others may have described something
        // subtly different from the catalog entry on purpose.
        const match = findPopularMatch(data.track);
        if (match) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `That matches our premade **${match.title}** track — already built and ready to go instantly. Want to use that, or should I build a custom one from what you told me?`,
            recommendation: { entry: match, directorTrack: data.track, directorMessage: data.message },
          }]);
          return;
        }

        await buildFromDirectorTrack(data.track, data.message, newMessages);
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

  const [pickingTrack, setPickingTrack] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const filteredPopularTracks = POPULAR_TRACKS.filter((entry) => {
    const q = norm(catalogSearch);
    if (!q) return true;
    return [entry.title, entry.subject, entry.examBoard, entry.level].some((f) => norm(f).includes(q));
  });

  /** One-click path: skip the chat entirely for a known catalog identity — used by both the "Check
   *  premade tracks" popup and the chat's own recommendation buttons. */
  const handlePopularTrack = async (entry: PopularTrack) => {
    if (!user || isLoading || pickingTrack) return;
    setShowCatalog(false);
    setPickingTrack(entry.title);
    setIsLoading(true);
    setBuildStatus(`Building ${entry.title}…`);
    try {
      const ok = await buildAndCreateTrack(
        { title: entry.title, subject: entry.subject, level: entry.level, examBoard: entry.examBoard },
        [{ role: "user", content: entry.title }],
      );
      if (!ok) throw new Error("could not build this track");
      setMessages(prev => [...prev, { role: "assistant", content: `Your ${entry.title} track is ready.` }]);
      setTrackCreated(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I hit an error building ${entry.title}. Try again, or describe it in the chat instead.` }]);
    } finally {
      setIsLoading(false);
      setPickingTrack(null);
      setBuildStatus("");
    }
  };

  /** Student clicked "Build custom instead" on a recommendation — proceed with the director's own
   *  parse rather than the catalog entry, and clear the buttons so they can't be clicked twice. */
  const declineRecommendation = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.recommendation || isLoading) return;
    const { directorTrack, directorMessage } = msg.recommendation;
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, recommendation: undefined } : m)));
    setIsLoading(true);
    try {
      await buildFromDirectorTrack(directorTrack, directorMessage, messages);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I hit an error. Please try again." }]);
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
                {msg.recommendation && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handlePopularTrack(msg.recommendation!.entry)}
                      disabled={isLoading}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Use {msg.recommendation.entry.title}
                    </button>
                    <button
                      onClick={() => declineRecommendation(i)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Build custom instead
                    </button>
                  </div>
                )}
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

        {/* Example prompts + the premade-tracks popup trigger. The catalog itself lives in a Dialog
            (see below) rather than sitting inline — it doesn't need to permanently occupy space above
            the chat, and it's reachable the same way at any point in the conversation, not just at
            the start. */}
        {!trackCreated && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => setShowCatalog(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-all"
            >
              <LayoutGrid className="h-3 w-3" /> Check premade tracks
            </button>
            {messages.length <= 2 && EXAMPLE_PROMPTS.map((p) => (
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

        <Dialog open={showCatalog} onOpenChange={(open) => { setShowCatalog(open); if (!open) setCatalogSearch(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Premade tracks</DialogTitle>
              <DialogDescription>Already built and audited — pick one to skip straight to your dashboard.</DialogDescription>
            </DialogHeader>
            {/* A flat grid stops scaling once this catalog grows past a screenful — search is what
                keeps it a library instead of a wall of buttons as more identities get seeded. Matches
                on title, subject, board, or level so "physics", "AQA", and "A-Level" all work. */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search tracks…"
                autoFocus
                className="w-full bg-accent rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-hidden"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {filteredPopularTracks.map((entry) => (
                <button
                  key={entry.title}
                  onClick={() => handlePopularTrack(entry)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-left hover:border-primary/50 transition-all disabled:opacity-50"
                >
                  {pickingTrack === entry.title ? (
                    <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-accent">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <SubjectIcon subject={entry.subject} size="sm" className="!h-6 !w-6 !rounded-md" />
                  )}
                  <span className="text-xs text-foreground line-clamp-1">{entry.title}</span>
                </button>
              ))}
              {filteredPopularTracks.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-6">No premade track matches "{catalogSearch}" yet — describe it in the chat instead.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
