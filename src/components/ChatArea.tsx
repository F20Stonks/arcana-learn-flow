import { useState, useRef, useCallback } from "react";
import { Send, Sparkles, BookmarkPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useNotes } from "@/stores/NotesContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hey Alex! 👋 I see you're working on **Backpropagation** in Neural Networks. Let's pick up where we left off.\n\nLast time we covered the chain rule for computing gradients. Ready to dive into how gradients flow through a multi-layer network?",
  },
  {
    id: "2",
    role: "user",
    content: "Yes! I'm still a bit fuzzy on how the error signal propagates backwards through the layers.",
  },
  {
    id: "3",
    role: "assistant",
    content:
      "Great question. Think of it this way:\n\n1. **Forward pass** — input flows through each layer, producing activations\n2. **Loss computation** — we measure how far off the output is\n3. **Backward pass** — we compute ∂L/∂w for each weight by applying the chain rule layer by layer, starting from the output\n\nThe key insight is that each layer only needs the gradient from the layer *above* it (closer to the output) and its own local gradient. This makes it modular.\n\nWant me to walk through a concrete 2-layer example with numbers?",
  },
];

interface ChatAreaProps {
  activeSubtopicTitle: string;
  trackId: string;
  topicId: string;
  subtopicId: string;
}

export function ChatArea({ activeSubtopicTitle, trackId, topicId, subtopicId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [savedMsgIds, setSavedMsgIds] = useState<Set<string>>(new Set());
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { addNote } = useNotes();

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm a demo AI tutor — in a real app I'd respond with a thoughtful explanation here! 🎓",
      },
    ]);
    setInput("");
  };

  const saveFullMessage = (msg: Message) => {
    addNote({ trackId, topicId, subtopicId, content: msg.content });
    setSavedMsgIds((prev) => new Set([...prev, msg.id]));
  };

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionPopup(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text: selection.toString().trim() });
  }, []);

  const saveSelection = () => {
    if (!selectionPopup) return;
    addNote({ trackId, topicId, subtopicId, content: selectionPopup.text });
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Topic header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{activeSubtopicTitle}</span>
        <span className="text-xs text-muted-foreground ml-2">AI Tutor Session</span>
      </div>

      {/* Selection popup */}
      {selectionPopup && (
        <button
          onClick={saveSelection}
          style={{ position: "fixed", left: selectionPopup.x, top: selectionPopup.y, transform: "translate(-50%, -100%)" }}
          className="z-50 flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <BookmarkPlus className="h-3 w-3" />
          Add to Notes
        </button>
      )}

      {/* Messages */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        onMouseUp={handleMouseUp}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex group", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div className="relative max-w-[70%]">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border text-card-foreground rounded-bl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ol]:mb-2 [&_strong]:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* Save full message button */}
              {msg.role === "assistant" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => saveFullMessage(msg)}
                      className={cn(
                        "absolute -right-10 top-2 h-7 w-7 rounded-md flex items-center justify-center transition-all",
                        savedMsgIds.has(msg.id)
                          ? "bg-primary/20 text-primary"
                          : "opacity-0 group-hover:opacity-100 bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {savedMsgIds.has(msg.id) ? <Check className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {savedMsgIds.has(msg.id) ? "Saved to notes" : "Save to notes"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 bg-surface-input border border-border rounded-xl px-4 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask Jarvis anything…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
