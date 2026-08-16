import { useState, useRef, useEffect } from "react";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { getBearerToken } from "@/lib/authHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import MathRenderer from "@/components/MathRenderer";
import { Sparkles, CornerDownLeft, X, Loader2 } from "lucide-react";

interface ResourceAssistantProps {
  resourceId: string;
  page: number;
  pageText: string;
  selection: string;
  onClearSelection: () => void;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  page?: number;
}

/** Offered when nothing is highlighted — the three things a stuck reader actually asks. */
const QUICK_ASKS = [
  "Explain this page in plain terms",
  "What's the key idea here?",
  "Work through this step by step",
];

export default function ResourceAssistant({
  resourceId,
  page,
  pageText,
  selection,
  onClearSelection,
}: ResourceAssistantProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    // Captured now, not read at stream time: the student can turn the page while an answer is streaming,
    // and the answer must stay attached to the page the question was about.
    const askedPage = page;
    const askedSelection = selection;

    setMessages((prev) => [...prev, { role: "user", content: q, page: askedPage }]);
    setInput("");
    setBusy(true);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/resource-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        body: JSON.stringify({
          resourceId,
          question: q,
          page: askedPage,
          pageText,
          selection: askedSelection,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
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
            const delta = JSON.parse(jsonStr).choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
                }
                return [...prev, { role: "assistant", content }];
              });
            }
          } catch {
            break;
          }
        }
      }
      if (!content) throw new Error("Empty response");
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't answer that just now. Try again." },
      ]);
    } finally {
      setBusy(false);
      onClearSelection();
    }
  }

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Ask about this document</span>
      </div>

      {/* A plain scroll container, not <ScrollArea>: that component renders its own Radix viewport and
          does not forward a ref to it, so there would be no element to call scrollTo on and the panel
          would silently stop following the stream. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Highlight anything on the page and ask about it, or start with:
              </p>
              <div className="flex flex-col gap-2">
                {QUICK_ASKS.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    className="justify-start text-left h-auto py-2 whitespace-normal"
                    onClick={() => ask(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "text-right" : ""}>
              {msg.role === "user" ? (
                <div className="inline-block max-w-[90%] rounded-lg bg-primary/10 px-3 py-2 text-left text-sm">
                  {msg.page && (
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      p.{msg.page}
                    </span>
                  )}
                  {msg.content}
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                  <MathRenderer content={msg.content} />
                </div>
              )}
            </div>
          ))}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="border-t p-3">
        {selection && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Selected
            </Badge>
            <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{selection}</p>
            <button
              onClick={onClearSelection}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention every chat input in this app uses.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={selection ? "Ask about the highlighted text…" : "Ask about this page…"}
            className="min-h-[64px] resize-none pr-10 text-sm"
            disabled={busy}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute bottom-2 right-2 h-7 w-7"
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
