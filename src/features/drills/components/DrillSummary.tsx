import { Loader2, Repeat, ArrowLeft, Zap } from "lucide-react";
import type { DrillRunResult } from "../engine/useDrillRun";

interface Props {
  result: DrillRunResult | null;
  liveCorrect: number;
  liveTotal: number;
  isBest: boolean;
  onReplay: () => void;
  onExit: () => void;
}

export default function DrillSummary({ result, liveCorrect, liveTotal, isBest, onReplay, onExit }: Props) {
  const correct = result?.correctCount ?? liveCorrect;
  const total = result ? result.correctCount + result.incorrectCount : liveTotal;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      {isBest && (
        <span className="readout rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          New personal best
        </span>
      )}
      <div>
        <div className="font-mono text-6xl font-bold tabular-nums text-foreground">
          {result ? result.score : <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">correct per minute</div>
      </div>

      <div className="flex gap-8">
        <div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{correct}/{total}</div>
          <div className="text-xs text-muted-foreground">correct</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{accuracy}%</div>
          <div className="text-xs text-muted-foreground">accuracy</div>
        </div>
        {result && (
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-2xl font-semibold tabular-nums text-primary">
              <Zap className="h-4 w-4" />+{result.xpEarned}
            </div>
            <div className="text-xs text-muted-foreground">XP</div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReplay}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Repeat className="h-4 w-4" /> Run it again
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Drills
        </button>
      </div>
    </div>
  );
}
