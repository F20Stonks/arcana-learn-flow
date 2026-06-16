import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Loader2, Clock, Zap, BookOpen, X } from "lucide-react";
import "katex/dist/katex.min.css";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";

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
  const [showNotes, setShowNotes] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

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
            await supabase.from("profiles").update({ total_xp: (await supabase.from("profiles").select("total_xp").eq("user_id", user!.id).single()).data!.total_xp + xp_earned }).eq("user_id", user!.id);
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
        await supabase.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId);
      }
    }
    navigate(-1);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{subtopic?.title}</p>
            <p className="text-xs text-muted-foreground truncate">{topic?.title} · {track?.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{formatTime(sessionTime)}</div>
          {xpEarned > 0 && <div className="flex items-center gap-1 text-xs text-xp"><Zap className="h-3.5 w-3.5" />+{xpEarned}</div>}
          <button onClick={() => setShowNotes(!showNotes)} className="text-muted-foreground hover:text-foreground md:hidden"><BookOpen className="h-4 w-4" /></button>
          <button onClick={endSession} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">End</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
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
        </div>

        <aside className={`${showNotes ? "block" : "hidden"} md:block w-full md:w-80 border-l border-border bg-card overflow-y-auto`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Knowledge Bank</h3>
            <button onClick={() => setShowNotes(false)} className="md:hidden text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Notes will appear here as you learn.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="bg-accent rounded-lg p-3">
                  <h4 className="text-xs font-medium text-foreground mb-1">{n.title}</h4>
                  <div className="text-xs text-muted-foreground">
                    <MathRenderer content={n.content} />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
