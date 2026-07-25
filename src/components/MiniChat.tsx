import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, HelpCircle } from "lucide-react";
import MathRenderer from "./MathRenderer";

interface MiniChatProps {
  question: string;
  correctAnswer: string;
  explanation: string;
  context: { subject?: string; level?: string };
  onClose: () => void;
  onScheduleReview?: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Mini-chat for when a student gets a question wrong.
 * Progressive hints → first-principles explanation → suggest review.
 */
export default function MiniChat({ question, correctAnswer, explanation, context, onClose, onScheduleReview }: MiniChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I see you found this one tricky. How did you approach it? Walk me through your thinking.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hintLevel, setHintLevel] = useState(0); // 0 = ask approach, 1+ = progressive hints
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setStreaming(true);

    const newHintLevel = hintLevel + 1;
    setHintLevel(newHintLevel);

    const hintInstructions = newHintLevel <= 1
      ? "Give a gentle HINT only — do NOT reveal the answer. Ask a guiding question to help them think."
      : newHintLevel === 2
      ? "Give a stronger hint with the first step of the solution. Still try not to give the full answer."
      : "The student is struggling. Explain the solution step-by-step from first principles in a simple, clear manner. Use simple language. After explaining, suggest they schedule a review of this topic.";

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          context: {
            ...context,
            subtopic: "Question Help",
            topic: "Review",
          },
          systemOverride: `You are Jarvis helping a student who got a question wrong. Be concise (2-4 sentences max).

Question: ${question}
Correct answer: ${correctAnswer}
Full explanation: ${explanation}

${hintInstructions}

Use $...$ for inline math and $$...$$ for block math. Keep responses SHORT.`,
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
          if (!line.startsWith("data: ") || line.trim() === "") continue;
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
            break;
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Try again." }]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Need help?</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground"
            }`}>
              <MathRenderer content={msg.content} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Schedule review button (after 3+ hints) */}
      {hintLevel >= 3 && onScheduleReview && (
        <div className="px-4 pb-2">
          <button
            onClick={onScheduleReview}
            className="w-full py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
          >
            📅 Schedule review for this topic
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 bg-accent rounded-lg px-3 py-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Explain your thinking..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            disabled={streaming}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30"
          >
            {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
