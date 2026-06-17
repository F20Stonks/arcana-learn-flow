import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Loader2, Clock, Zap } from "lucide-react";
import "katex/dist/katex.min.css";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";
import MathTheater from "@/components/workspace/MathTheater";
import BridgeCards from "@/components/workspace/BridgeCards";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ChoiceType = "mcq" | "truefalse" | "match" | "freeform";
interface ChoiceBlock {
  type: ChoiceType;
  options: string[];
}

function extractChoices(raw: string): { text: string; choices: ChoiceBlock | null } {
  const re = /<choices\s+type="(mcq|truefalse|match|freeform)"\s*>([\s\S]*?)<\/choices>/i;
  const m = raw.match(re);
  if (!m) return { text: raw, choices: null };
  const type = m[1].toLowerCase() as ChoiceType;
  const body = m[2];
  const options = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const text = raw.replace(re, "").trim();
  return { text, choices: { type, options } };
}

export default function SessionPage() {
  const { subtopicId } = useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [subtopic, setSubtopic] = useState<Tables<"subtopics"> | null>(null);
  const [topic, setTopic] = useState<Tables<"topics"> | null>(null);
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [notes, setNotes] = useState<Tables<"notes">[]>([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  const goBack = () => {
    const dest = topic?.track_id ? `/track/${topic.track_id}` : "/";
    navigate(dest, { replace: true });
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!subtopicId || !user) return;
    loadContext();
  }, [subtopicId, user]);

  const loadContext = async () => {
    const { data: sub } = await supabase.from("subtopics").select("*").eq("id", subtopicId!).single();
    setSubtopic(sub);
    if (!sub) return;

    const { data: t } = await supabase.from("topics").select("*").eq("id", sub.topic_id).single();
    setTopic(t);
    if (t) {
      const { data: tr } = await supabase.from("learning_tracks").select("*").eq("id", t.track_id).single();
      setTrack(tr);
    }

    const { data: sess } = await supabase.from("sessions").insert({
      user_id: user!.id, subtopic_id: subtopicId!, session_type: "learn",
    }).select().single();
    if (sess) setSessionId(sess.id);

    if (sub.status === "unlocked") {
      await supabase.from("subtopics").update({ status: "in_progress" }).eq("id", sub.id);
    }

    const { data: existingNotes } = await supabase.from("notes").select("*").eq("subtopic_id", subtopicId!).eq("user_id", user!.id);
    setNotes(existingNotes || []);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !sessionId) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    await supabase.from("messages").insert({ session_id: sessionId, role: "user", content: text });

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            subtopic: subtopic?.title, topic: topic?.title,
            subject: track?.subject, level: track?.level, examBoard: track?.exam_board,
          },
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        await supabase.from("messages").insert({ session_id: sessionId, role: "assistant", content: assistantContent });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const endSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (sessionId) {
      try {
        const resp = await supabase.functions.invoke("assess-session", {
          body: { sessionId, subtopicId, messages },
        });
        if (resp.data) {
          const { complete, xp_earned, notes_to_save } = resp.data;
          setXpEarned(xp_earned || 0);
          if (complete && subtopic) {
            await supabase.from("subtopics").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", subtopic.id);
          }
          if (xp_earned) {
            const { data: p } = await supabase.from("profiles").select("total_xp").eq("user_id", user!.id).single();
            if (p) await supabase.from("profiles").update({ total_xp: (p.total_xp || 0) + xp_earned }).eq("user_id", user!.id);
          }
          if (notes_to_save) {
            for (const n of notes_to_save) {
              await supabase.from("notes").insert({ user_id: user!.id, subtopic_id: subtopicId!, title: n.title, content: n.content });
            }
          }
          await supabase.from("sessions").update({ completed_at: new Date().toISOString(), xp_earned }).eq("id", sessionId);
          await refreshProfile();
        }
      } catch {
        try { await supabase.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId); } catch {}
      }
    }
    setIsEnding(false);
    goBack();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{subtopic?.title}</p>
            <p className="text-xs text-muted-foreground truncate">{topic?.title} · {track?.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{formatTime(sessionTime)}</div>
          {xpEarned > 0 && <div className="flex items-center gap-1 text-xs text-xp"><Zap className="h-3.5 w-3.5" />+{xpEarned}</div>}
          <button onClick={endSession} disabled={isEnding} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {isEnding && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEnding ? "Ending…" : "End"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* LEFT — Companion Panel (40%) */}
        <div className="w-full lg:w-2/5 flex flex-col min-h-0 border-r border-border">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Start your session. Ask Jarvis anything about <strong className="text-foreground">{subtopic?.title}</strong>.</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const { text } = isUser ? { text: msg.content } : extractChoices(msg.content);
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground"
                        : "max-w-[90%] sm:max-w-[80%] text-sm leading-relaxed text-foreground"
                    }
                  >
                    <MathRenderer content={text} />
                  </div>
                </div>
              );
            })}
            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <InteractionPanel
            messages={messages}
            isStreaming={isStreaming}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
          />

          <BridgeCards
            subject={track?.subject}
            onPick={(hint) => sendMessage(hint)}
          />
        </div>

        {/* RIGHT — Math Theater (60%) */}
        <div className="hidden lg:flex lg:w-3/5 min-h-0">
          <MathTheater subtopicId={subtopicId} />
        </div>
      </div>
    </div>
  );
}

function InteractionPanel({
  messages,
  isStreaming,
  input,
  setInput,
  onSend,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
}) {
  const last = messages[messages.length - 1];
  const choices =
    last && last.role === "assistant" && !isStreaming
      ? extractChoices(last.content).choices
      : null;

  const [showText, setShowText] = useState(false);

  if (choices && choices.options.length > 0 && choices.type !== "freeform" && !showText) {
    return (
      <div className="p-4 border-t border-border bg-background">
        <div className="flex flex-wrap gap-2 mb-2">
          {choices.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onSend(opt)}
              disabled={isStreaming}
              className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-accent hover:border-primary/40 transition-colors text-left leading-snug disabled:opacity-40"
            >
              <MathRenderer content={opt} />
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowText(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Type instead →
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              onSend(input);
              setShowText(false);
            }
          }}
          placeholder={choices?.type === "freeform" ? "Type your answer…" : "Ask Jarvis…"}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          disabled={isStreaming}
          autoFocus
        />
        <button
          onClick={() => {
            onSend(input);
            setShowText(false);
          }}
          disabled={!input.trim() || isStreaming}
          className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
