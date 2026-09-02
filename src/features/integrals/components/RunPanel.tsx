import { useEffect, useRef } from "react";
import { ArrowRight, CornerDownLeft, Flag, Timer } from "lucide-react";
import AnswerInput from "./AnswerInput";
import ConfirmButton from "./ConfirmButton";
import HintLadder from "./HintLadder";
import IntegralPrompt from "./IntegralPrompt";
import SolutionSteps from "./SolutionSteps";
import VerdictLine from "./VerdictLine";
import { formatDuration, PAR_SECONDS } from "../scoring";
import type { RunApi } from "../hooks/useIntegralRun";
import type { Problem } from "../types";

interface Props {
  problem: Problem;
  run: RunApi;
  /** Rendered under the solution once the run ends — the result card, or the next-problem control. */
  footer?: React.ReactNode;
  showTimer?: boolean;
  /**
   * Ask before revealing. The daily's give-up spends the only scored attempt of that day and
   * cannot be undone, so one stray click should not be able to spend it.
   */
  confirmGiveUp?: boolean;
  /**
   * Bound to Enter once the run is over. Enter submits an answer, so a student's hands are already
   * there; without this the loop stops dead at every solve and waits for the mouse.
   */
  onAdvance?: () => void;
  /** What Enter does, named on screen — a shortcut nobody knows about is not a shortcut. */
  advanceLabel?: string;
  /** Training only: move straight to the next problem without answering or seeing the solution —
   *  no XP, no penalty, nothing recorded. Omitted entirely on the daily, where one attempt per
   *  puzzle is the whole point. */
  onSkip?: () => void;
}

/** The play surface, shared by the daily and by training so they can never drift apart. */
export default function RunPanel({
  problem,
  run,
  footer,
  showTimer = true,
  confirmGiveUp = false,
  onAdvance,
  advanceLabel = "next",
  onSkip,
}: Props) {
  const over = run.status !== "running";
  const par = PAR_SECONDS[problem.difficulty];
  const result = useRef<HTMLDivElement>(null);

  // When the run ends the input it was on disappears. Without this, keyboard focus falls back to
  // the document and a screen reader user has to hunt for the result they just earned.
  useEffect(() => {
    if (over) result.current?.focus();
  }, [over]);

  // Enter carries on. Bound to the window rather than the result card because focus legitimately
  // moves around the finished run — the solution steps and technique links are all tabbable.
  useEffect(() => {
    if (!over || !onAdvance) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // Never hijack Enter from a control that means something by it.
      if (el?.closest("input, textarea, select, button, a, [contenteditable]")) return;
      e.preventDefault();
      onAdvance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, onAdvance]);

  return (
    <div className="flex flex-col gap-5">
      {showTimer && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="readout flex items-center gap-1.5 tabular-nums">
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(run.elapsed)}
            <span className="text-muted-foreground/50">/ par {formatDuration(par)}</span>
          </span>
          {run.wrongAttempts > 0 && (
            <span className="readout tabular-nums">
              {run.wrongAttempts} wrong {run.wrongAttempts === 1 ? "try" : "tries"}
            </span>
          )}
        </div>
      )}

      <IntegralPrompt problem={problem} />

      {!over && (
        <>
          <AnswerInput
            value={run.input}
            onChange={run.setInput}
            onSubmit={run.submit}
            verdict={run.verdict}
            problem={problem}
          />
          <VerdictLine verdict={run.verdict} />
          <HintLadder hints={problem.hints} used={run.hintsUsed} onReveal={run.revealHint} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Revealing costs the daily its one scored attempt, so there it asks first. In
                training it costs nothing, so it does not. */}
            {confirmGiveUp ? (
              <ConfirmButton
                onConfirm={run.giveUp}
                confirmLabel="That ends today's attempt for good."
                icon={<Flag className="h-3.5 w-3.5" />}
              >
                Show me the solution
              </ConfirmButton>
            ) : (
              <button
                onClick={run.giveUp}
                className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <Flag className="h-3.5 w-3.5" /> Show me the solution
              </button>
            )}
            {onSkip && (
              <button
                onClick={onSkip}
                className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                Skip <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {over && (
        <div ref={result} tabIndex={-1} className="flex flex-col gap-5 outline-hidden">
          {footer}
          <SolutionSteps problem={problem} />
          {onAdvance && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
              <kbd className="readout rounded border border-border px-1.5 py-0.5 text-[11px]">
                <CornerDownLeft className="inline h-3 w-3" />
              </kbd>
              Enter for {advanceLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
