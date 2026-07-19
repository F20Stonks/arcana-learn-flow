import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import BrandLogo from "@/components/BrandLogo";

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
    { role: "assistant", content: "Hey, I'm Jarvis. Tell me what you want to master and I'll build your personal learning track." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [trackCreated, setTrackCreated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Grain-refinement pass (pillar A: tracks must be correctly sized). jarvis-director produces a
  // spec-grounded track, but its subtopics are often too broad to be one self-contained session
  // (e.g. "Complex Number Arithmetic" is really 4-5 sittings). This takes the generated topics and,
  // via the ALREADY-DEPLOYED chat function's systemOverride, splits any over-broad subtopic into
  // session-grain ones — preserving the grounded topic structure. Returns subtopic-arrays aligned by
  // topic index, or null on any problem (caller then keeps the original, unrefined subtopics).
  const refineTrackGrain = async (track: { topics: { title: string; subtopics: string[] }[] }): Promise<string[][] | null> => {
    try {
      const sys = `You are a curriculum editor. You are given a track's topics with their subtopics. Your ONE job is GRANULARITY: every subtopic must be a single SELF-CONTAINED lesson — one core idea plus its immediate practice, fully learnable in one ~20-30 minute sitting.
Rules:
- If a subtopic is too broad for one sitting (it bundles several distinct ideas, e.g. "Complex Number Arithmetic", "Differentiation", "Trigonometry"), SPLIT it into ordered session-grain subtopics.
- Leave already-well-sized subtopics exactly as they are.
- Do NOT add, remove, or reorder TOPICS — return exactly the same number of topics, in the same order, with the same titles.
- Order subtopics so prerequisites come before what depends on them.
- Do not invent material beyond the track's evident scope; only split what is already there. Cap each topic at 10 subtopics.
This applies to ALL of mathematics and physics, from high-school (GCSE / A-level) to undergraduate. Adapt the grain to whatever material you are given — never to a fixed template. Judge "one sitting" relative to the track's own level.
Good grain (one idea each): "Argand diagrams: plotting a complex number", "Resolving a projectile's velocity into components", "Gauss's law for a single point charge", "Solving a linear equation in one variable".
Too coarse (bundles many distinct ideas — must be split): "Complex Numbers", "Calculus", "Electromagnetism", "Forces and Motion".
Return ONLY JSON — no prose, no markdown fences:
{"topics":[{"title":"<unchanged title>","subtopics":["...","..."]}]}`;
      const payload = { topics: track.topics.map((t) => ({ title: t.title, subtopics: t.subtopics })) };
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Refine the granularity of this track:\n${JSON.stringify(payload)}` }],
          systemOverride: sys,
        }),
      });
      if (!resp.ok || !resp.body) return null;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const d = JSON.parse(j).choices?.[0]?.delta?.content;
            if (d) acc += d;
          } catch { /* skip non-content events */ }
        }
      }

      const match = acc.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const refinedTopics = JSON.parse(match[0]).topics;
      // Must align 1:1 with the grounded topics; otherwise discard and keep the original.
      if (!Array.isArray(refinedTopics) || refinedTopics.length !== track.topics.length) return null;
      const result: string[][] = [];
      for (const rt of refinedTopics) {
        const subs = Array.isArray(rt?.subtopics)
          ? rt.subtopics.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 10)
          : [];
        if (subs.length === 0) return null; // a topic lost all subtopics → unsafe, fall back
        result.push(subs);
      }
      return result;
    } catch {
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
        // Track was generated - save to DB
        const { data: track } = await supabase.from("learning_tracks").insert({
          user_id: user.id,
          title: data.track.title,
          subject: data.track.subject,
          emoji: data.track.emoji || "📚",
          exam_board: data.track.exam_board,
          level: data.track.level,
          exam_date: data.track.exam_date,
        }).select().single();

        if (track) {
          // Split over-broad subtopics into session-grain ones before saving. Falls back to the
          // original subtopics for any topic if the refinement is unavailable or malformed.
          const refinedGrain = await refineTrackGrain(data.track);
          for (let ti = 0; ti < data.track.topics.length; ti++) {
            const t = data.track.topics[ti];
            const subtopics = (refinedGrain && refinedGrain[ti]) || t.subtopics;
            const { data: topic } = await supabase.from("topics").insert({
              track_id: track.id,
              title: t.title,
              order_index: ti,
              status: "unlocked",
            }).select().single();

            if (topic) {
              for (let si = 0; si < subtopics.length; si++) {
                await supabase.from("subtopics").insert({
                  topic_id: topic.id,
                  title: subtopics[si],
                  order_index: si,
                  status: "unlocked",
                  estimated_minutes: 30,
                });
              }
            }
          }
        }

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
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
              placeholder="Tell Jarvis what you want to learn…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
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
