import { Shapes, Check } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import type { DerivedNote } from "@/lib/sessionNotes";

interface VizEntry {
  id: string;
  preview: string;
  messageIndex: number;
}

interface Props {
  notes: DerivedNote[];
  vizHistory: VizEntry[];
  activeVizId: string | null;
  onSelectViz: (id: string) => void;
  onJumpToCard: (messageIndex: number) => void;
  /** Drives the "writing" shimmer on the pending note row. */
  isStreaming: boolean;
}

/**
 * The session's notes, written as it happens.
 *
 * The point is that the student never has to decide to take notes. By the end there is already a
 * clean, short record of every claim the lesson established and every picture it used — which is
 * both the revision material and the visible proof that the session went somewhere.
 */
export default function NotesPanel({
  notes, vizHistory, activeVizId, onSelectViz, onJumpToCard, isStreaming,
}: Props) {
  const empty = notes.length === 0 && vizHistory.length === 0;

  return (
    <div className="h-full overflow-y-auto px-3.5 pb-4">
      {empty && !isStreaming && (
        <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Notes will collect here as the lesson goes.
        </p>
      )}

      <ol className="space-y-2.5">
        {notes.map((note) => (
          <li key={note.messageIndex}>
            <button
              onClick={() => onJumpToCard(note.messageIndex)}
              className="block w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors duration-200 hover:border-border/70 hover:bg-accent/50"
            >
              {note.headline && (
                <p className="text-[12.5px] leading-[1.55] text-foreground">
                  <MathRenderer content={note.headline} />
                </p>
              )}

              {note.formulas.map((f, i) => (
                <div key={i} className="mt-2 overflow-x-auto rounded-lg bg-secondary/50 px-2.5 py-2 text-[12px]">
                  <MathRenderer content={`$$${f}$$`} />
                </div>
              ))}

              {note.terms.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.terms.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/90"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </li>
        ))}

        {isStreaming && (
          <li className="px-3 py-2.5">
            {/* The looping sweep: a note is being formed from the turn currently streaming in. */}
            <div className="h-2.5 w-4/5 overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full w-1/3 animate-sheen rounded-full bg-linear-to-r from-transparent via-primary/50 to-transparent" />
            </div>
            <div className="mt-1.5 h-2.5 w-2/5 overflow-hidden rounded-full bg-secondary/40" />
          </li>
        )}
      </ol>

      {vizHistory.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-3">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Visuals · {vizHistory.length}
          </p>
          <div className="space-y-1">
            {vizHistory.map((v) => {
              const active = v.id === activeVizId;
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectViz(v.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-200 ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {active ? <Check className="h-3 w-3 shrink-0" /> : <Shapes className="h-3 w-3 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate text-[11px]">{v.preview}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
