import { createContext, useContext, useState } from "react";
import { Flag, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * Flagging a turn — the one channel where a human judgement gets attached to an exact moment.
 *
 * A grader can sweep thousands of transcripts and still never tell you a turn was correct and
 * completely lifeless. That reading is human, and it is only useful if it lands on the turn that
 * provoked it: a note written afterwards ("it lost me somewhere in the middle") cannot be lined up
 * against a transcript position, so it can never be used to correct a rubric.
 *
 * Deliberately one click to open and one click to file. Anything heavier and it stops being used
 * during real study, which is the only time the judgement is worth having.
 */

interface SessionFlagCtx {
  sessionId: string | null;
  subtopicId: string | null;
}

const FlagContext = createContext<SessionFlagCtx>({ sessionId: null, subtopicId: null });

/** Provided once by SessionPage — spares three separate view components a prop-drilling chain. */
export const SessionFlagProvider = FlagContext.Provider;

const TAGS = [
  { id: "wrong", label: "Wrong" },
  { id: "confusing", label: "Confusing" },
  { id: "too-fast", label: "Too fast" },
  { id: "too-slow", label: "Too slow" },
  { id: "lifeless", label: "Lifeless" },
  { id: "great", label: "Great" },
] as const;

export default function TurnFlagButton({
  messageIndex,
  excerpt,
}: {
  messageIndex: number;
  excerpt: string;
}) {
  const { sessionId, subtopicId } = useContext(FlagContext);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const submit = async () => {
    if (saving || (selected.length === 0 && !note.trim())) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return;
      // `session_turn_flags` post-dates the generated types file — cast like the other
      // not-yet-typed tables rather than hand-editing generated output.
      await (supabase.from("session_turn_flags" as never) as any).insert({
        user_id: userId,
        session_id: sessionId,
        subtopic_id: subtopicId,
        message_index: messageIndex,
        role: "assistant",
        excerpt: excerpt.slice(0, 2000),
        tags: selected,
        note: note.trim() || null,
      });
      setSaved(true);
      setOpen(false);
    } catch {
      /* a lost flag is not worth interrupting a study session over */
    } finally {
      setSaving(false);
      setSelected([]);
      setNote("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title={saved ? "Flagged" : "Flag this turn"}
          aria-label={saved ? "Turn flagged" : "Flag this turn"}
          className={`inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:border-border hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 ${
            // A filed flag stays visible; an unused one behaves like "Keep" and hides until hover, so
            // a page of turns still reads as prose rather than a grid of controls.
            saved ? "text-primary opacity-100" : "text-muted-foreground opacity-0"
          }`}
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
          {saved ? "Flagged" : "Flag"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          What happened here?
        </p>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {TAGS.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — what would have been better?"
          className="mb-2.5 min-h-[64px] text-[12.5px]"
        />
        <button
          onClick={submit}
          disabled={saving || (selected.length === 0 && !note.trim())}
          className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "File it"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
