import { Shapes, Check, BookmarkPlus } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import { useSmoothReveal } from "@/lib/useSmoothReveal";
import type { CanvasMessage, Turn } from "@/lib/sessionTurns";

/**
 * A turn's prose, revealed at reading pace while it streams.
 *
 * Split into its own component so the reveal hook runs per-turn: only the live turn animates, and
 * every earlier one renders its finished text with no per-frame work at all.
 */
export function TurnProse({
  raw, cleanText, streaming, revealRate,
}: { raw: string; cleanText: (s: string) => string; streaming: boolean; revealRate: number }) {
  const full = cleanText(raw);
  const shown = useSmoothReveal(full, streaming, revealRate);
  const settling = streaming && shown.length < full.length;

  return (
    <div
      className="relative text-foreground/95"
      style={{
        fontFamily: "var(--sx-font)",
        fontSize: "var(--sx-text, 13.5px)",
        lineHeight: "var(--sx-leading, 1.85)",
      }}
    >
      <MathRenderer content={shown} />
      {settling && (
        <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary/70 animate-pulse" />
      )}
    </div>
  );
}

interface Props {
  turn: Turn;
  messages: CanvasMessage[];
  cleanText: (raw: string) => string;
  vizId?: string;
  onStage: boolean;
  onSelectViz: (vizId: string) => void;
  onSaveNote: (assistantIndex: number) => void;
  streaming: boolean;
  revealRate: number;
}

/**
 * What one turn LOOKS like — the question that opened it, the answer, and the two things you can do
 * with the answer. Written once and shared by all three views of the session, so switching between
 * the canvas, the deck and the chat changes the arrangement of the lesson and nothing else about it.
 */
export default function TurnBody({
  turn, messages, cleanText, vizId, onStage, onSelectViz, onSaveNote, streaming, revealRate,
}: Props) {
  const { userIndex, assistantIndex } = turn;

  return (
    <>
      {userIndex !== null && (
        <div className="mb-4 border-l border-primary/35 pl-3.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            You asked
          </p>
          <div
            className="leading-relaxed text-muted-foreground"
            style={{ fontFamily: "var(--sx-font)", fontSize: "var(--sx-text-sm, 12.5px)" }}
          >
            <MathRenderer content={messages[userIndex].content} />
          </div>
        </div>
      )}

      {assistantIndex !== null && (
        <>
          <TurnProse
            raw={messages[assistantIndex].content}
            cleanText={cleanText}
            streaming={streaming}
            revealRate={revealRate}
          />

          {/* Card actions. Only the diagram chip is ever persistent — "keep" stays invisible until
              the card is hovered, so a page of cards reads as prose, not as a grid of buttons. */}
          <div className="mt-5 flex items-center gap-2">
            {vizId && (
              <button
                onClick={() => onSelectViz(vizId)}
                disabled={onStage}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  onStage
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
                }`}
              >
                {onStage ? <Check className="h-3.5 w-3.5" /> : <Shapes className="h-3.5 w-3.5" />}
                {onStage ? "On the stage" : "Show on stage"}
              </button>
            )}
            <button
              onClick={() => onSaveNote(assistantIndex)}
              title="Keep this in your notes"
              className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-all duration-200 hover:border-border hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Keep
            </button>
          </div>
        </>
      )}
    </>
  );
}
