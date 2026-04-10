import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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

export function ChatArea({ activeSubtopicTitle }: { activeSubtopicTitle: string }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Topic header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{activeSubtopicTitle}</span>
        <span className="text-xs text-muted-foreground ml-2">AI Tutor Session</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
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
