import { getBearerToken } from "@/lib/authHeader";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Send, Loader2, ImagePlus, X } from "lucide-react";
import MathRenderer from "./MathRenderer";

type ChatMessage = { role: "user" | "assistant"; content: string; imageUrl?: string };

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // guard against hanging FileReader on a huge camera original
const MAX_IMAGE_DIM = 1600; // resized longest side — keeps the base64 payload reasonable

// Downscales onto a canvas so a 12MB phone photo doesn't balloon the request payload — the model
// doesn't need more than ~1600px to read a homework page or a diagram.
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Multimodal content the AI gateway expects when an image is attached — plain string otherwise
// so text-only messages (and every existing history entry) are untouched.
function toApiContent(m: ChatMessage): string | Array<Record<string, unknown>> {
  if (!m.imageUrl) return m.content;
  return [
    { type: "text", text: m.content || "What can you tell me about this?" },
    { type: "image_url", image_url: { url: m.imageUrl } },
  ];
}

// Self-contained general-purpose Q&A chat, wired to the `chat` edge function with no session
// context. Lives on the Dashboard now (moved out of the Hub sidebar, which cramped it). Accepts
// an attached image (e.g. a photo of a homework problem) alongside the question.
export default function GeneralChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything — about a specific topic, general study strategy, or what to focus on next. You can attach a photo of a problem too." },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const attachImage = async (file: File | null | undefined) => {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is too large (max 20MB).");
      return;
    }
    try {
      setPendingImage(await fileToResizedDataUrl(file));
    } catch {
      setImageError("Couldn't load that image. Try another one.");
    }
  };

  const send = async (text: string) => {
    if ((!text.trim() && !pendingImage) || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: text, imageUrl: pendingImage || undefined };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setPendingImage(null);
    setStreaming(true);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: toApiContent(m) })),
          systemOverride: `You are Cortexed, the student's general-purpose learning assistant, available outside of a specific tutoring session. Answer questions about their subjects, study strategy, or what to focus on next — including reading a photo of a problem they attach. Be concise (max 4 sentences unless the student asks for more detail). Use $...$ for inline math and $$...$$ for block math where relevant.`,
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
                if (last?.role === "assistant" && prev.length > allMessages.length) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
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
    <div className="flex flex-col">
      <div className="max-h-72 overflow-y-auto space-y-3 pr-1 mb-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
            }`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Attached" className="mb-1.5 max-h-40 rounded-lg object-contain" />
              )}
              {msg.content && <MathRenderer content={msg.content} />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent px-2 py-1.5">
          <img src={pendingImage} alt="Selected" className="h-10 w-10 rounded object-cover" />
          <span className="flex-1 text-xs text-muted-foreground">Image attached</span>
          <button
            onClick={() => setPendingImage(null)}
            className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            title="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {imageError && <div className="mb-2 text-xs text-destructive">{imageError}</div>}

      <div className="flex items-center gap-2 bg-accent rounded-lg px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void attachImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={streaming}
          title="Attach an image"
          className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          onPaste={(e) => {
            const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
            if (file) void attachImage(file);
          }}
          placeholder="Ask a question..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-hidden"
          disabled={streaming}
        />
        <button
          onClick={() => send(input)}
          disabled={(!input.trim() && !pendingImage) || streaming}
          className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30"
        >
          {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
