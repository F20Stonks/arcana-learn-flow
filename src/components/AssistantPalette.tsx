import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, CornerDownLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ask-anything palette: one keystroke from anywhere, and it takes you where you meant to go.
 *
 * The app has grown fourteen destinations, and a student who cannot remember whether saved diagrams
 * live under Notes, Concepts or the Resource Bank does not go looking — they just stop using the
 * feature. This is the answer to that, and it is deliberately a ROUTER rather than a chat: it moves
 * you, explains the app, or fetches a course's resources. It never teaches, because a session does
 * that far better and a half-teaching dialog box quietly competes with the product's best feature.
 *
 * Safety property worth keeping: the edge function resolves the destination itself from a closed
 * list of route keys and validates any id against the caller's own rows. This component navigates to
 * a path it is handed, so the model can never point a student at an arbitrary URL.
 */

type AssistantReply =
  | { action: "navigate"; path: string; message?: string }
  | { action: "answer"; message: string }
  | { action: "resources"; course: string; message?: string };

export default function AssistantPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setReply(null);
      // Focus after the dialog's own open animation, or the caret lands nowhere.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const ask = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setReply(null);
    try {
      const { data, error } = await supabase.functions.invoke("app-assistant", { body: { query: q } });
      if (error) throw error;
      const r = data as AssistantReply;

      if (r.action === "navigate") {
        setOpen(false);
        setQuery("");
        navigate(r.path);
        return;
      }
      if (r.action === "resources") {
        setReply(r.message || `Looking for ${r.course} materials…`);
        const { data: res } = await supabase.functions.invoke("resolve-course-resources", {
          body: { course: r.course },
        });
        const m = res?.manifest;
        setReply(
          m
            ? `Found ${m.verified} verified document${m.verified === 1 ? "" : "s"} for ${r.course}${
                m.gaps?.length ? ` · ${m.gaps.length} gap${m.gaps.length === 1 ? "" : "s"} noted` : ""
              }.`
            : "I couldn't reach that archive.",
        );
        return;
      }
      setReply(r.message);
    } catch {
      setReply("Something went wrong reaching the assistant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Jump to anywhere in the app"
        title="Jump to… (⌘K)"
        className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Compass className="h-[15px] w-[15px]" />
        <span className="hidden sm:inline">Jump to</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] text-muted-foreground/70 sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 p-0">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Compass className="h-4 w-4 shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
              placeholder="Take me to my due reviews…"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
            />
            {busy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
          </div>
          {reply && (
            <div className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">{reply}</div>
          )}
          {!reply && (
            <div className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground/70">
              Go somewhere, ask how a part of the app works, or have a course's papers found.
              {" "}For help with the maths itself, use Ask&nbsp;Cortexed on the dashboard.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
