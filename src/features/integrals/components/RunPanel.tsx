import { useEffect, useRef } from "react";
import { ArrowRight, Flag, Timer } from "lucide-react";
import AnswerInput from "./AnswerInput";
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
  /** Training only: move straight to the next problem without answering or seeing the solution —
   *  no XP, no penalty, nothing recorded. Omitted entirely on the daily, where one attempt per
   *  puzzle is the whole point. */
  onSkip?: () => void;
}

/** The play surface, shared by the daily and by training so they can never drift apart. */
export default function RunPanel({ problem, run, footer, showTimer = true, onSkip }: Props) {
  const over = run.status !== "running";
  const par = PAR_SECONDS[problem.difficulty];
  const result = useRef<HTMLDivElement>(null);

  // When the run ends the input it was on disappears. Without this, keyboard focus falls back to
  // the document and a screen reader user has to hunt for the result they just earned.
  useEffect(() => {
    if (over) result.current?.focus();
  }, [over]);

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
            placeholder={
              problem.kind === "definite" ? "a number, e.g. pi/4" : "your answer, e.g. x^3/3 + C"
            }
          />
          <VerdictLine verdict={run.verdict} />
          <HintLadder hints={problem.hints} used={run.hintsUsed} onReveal={run.revealHint} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              onClick={run.giveUp}
              className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" /> Show me the solution
            </button>
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
        </div>
      )}
    </div>
  );
}
