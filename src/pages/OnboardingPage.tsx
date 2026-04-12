import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
          for (let ti = 0; ti < data.track.topics.length; ti++) {
            const t = data.track.topics[ti];
            const { data: topic } = await supabase.from("topics").insert({
              track_id: track.id,
              title: t.title,
              order_index: ti,
              status: ti === 0 ? "unlocked" : "locked",
            }).select().single();

            if (topic) {
              for (let si = 0; si < t.subtopics.length; si++) {
                await supabase.from("subtopics").insert({
                  topic_id: topic.id,
                  title: t.subtopics[si],
                  order_index: si,
                  status: ti === 0 && si === 0 ? "unlocked" : "locked",
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
        <h1 className="text-xl font-bold text-foreground">Jarvis</h1>
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
