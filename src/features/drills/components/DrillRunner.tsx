import { Flame, Play, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MathRenderer } from "@/components/MathRenderer";
import type { DrillDefinition, DrillMode } from "../types";
import { useDrillRun } from "../engine/useDrillRun";
import NumericAnswerInput from "./NumericAnswerInput";
import VennDiagramInput from "./VennDiagramInput";
import BinaryChoiceInput from "./BinaryChoiceInput";
import CayleyTableView from "./CayleyTableView";
import InvariantPairView from "./InvariantPairView";
import GraphView from "./GraphView";
import KnotPairView from "./KnotPairView";
import DrillSummary from "./DrillSummary";

interface Props {
  def: DrillDefinition;
  mode: DrillMode;
  durationS: number;
  config?: Record<string, unknown>;
  previousBest?: number;
  onExit: () => void;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const looksLikeLatex = (s: string) => s.includes("\\") || s.includes("$");

export default function DrillRunner({ def, mode, durationS, config, previousBest, onExit }: Props) {
  const { user } = useAuth();
  const run = useDrillRun({ def, userId: user?.id, mode, durationS, config });
  const modeSpec = def.modes.find((m) => m.id === mode);

  if (run.status === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-14 text-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{def.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{modeSpec?.description}</p>
        </div>
        {previousBest !== undefined && (
          <div className="rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs text-muted-foreground">
            Personal best · <span className="font-mono font-semibold text-foreground">{previousBest}</span>/min
          </div>
        )}
        <button
          onClick={run.start}
          className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Play className="h-5 w-5" /> Start — {durationS}s
        </button>
        <button onClick={onExit} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    );
  }

  if (run.status === "finished") {
    const isBest = !!run.result && previousBest !== undefined && run.result.score > previousBest;
    const isBestNoPrior = !!run.result && previousBest === undefined && run.result.correctCount > 0;
    return (
      <DrillSummary
        result={run.result}
        liveCorrect={run.liveCorrect}
        liveTotal={run.liveTotal}
        isBest={isBest || isBestNoPrior}
        onReplay={() => {
          run.reset();
          setTimeout(run.start, 0);
        }}
        onExit={onExit}
      />
    );
  }

  const problem = run.problem;
  const timeFraction = Math.max(0, Math.min(1, run.timeLeftMs / (durationS * 1000)));

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center justify-between">
        <button onClick={onExit} aria-label="Exit drill" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4">
          {run.streak >= 3 && (
            <div className="flex items-center gap-1 text-sm font-semibold text-streak">
              <Flame className="h-4 w-4" /> {run.streak}
            </div>
          )}
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">{formatClock(run.timeLeftMs)}</div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-linear"
          style={{ width: `${timeFraction * 100}%` }}
        />
      </div>

      <div
        className={`flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 transition-colors ${
          run.flash === "correct" ? "border-primary/60" : run.flash === "incorrect" ? "border-destructive/60" : ""
        }`}
      >
        {problem?.visual?.kind === "cayley-table" && <CayleyTableView visual={problem.visual} />}
        {problem?.visual?.kind === "invariant-pair" && <InvariantPairView visual={problem.visual} />}
        {problem?.visual?.kind === "graph" && <GraphView visual={problem.visual} />}
        {problem?.visual?.kind === "knot-pair" && <KnotPairView visual={problem.visual} />}

        <div className="min-h-[3rem] text-center text-3xl font-semibold text-foreground">
          {problem && (looksLikeLatex(problem.prompt) ? <MathRenderer content={problem.prompt} /> : problem.prompt)}
        </div>

        {problem && def.inputKind === "numeric" && <NumericAnswerInput key={problem.id} onSubmit={run.submit} />}
        {problem && def.inputKind === "venn" && <VennDiagramInput key={problem.id} onSubmit={run.submit} />}
        {problem && def.inputKind === "binary" && def.binaryOptions && (
          <BinaryChoiceInput key={problem.id} options={def.binaryOptions} onSubmit={run.submit} />
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {run.liveCorrect}/{run.liveTotal} correct this run
      </div>
    </div>
  );
}
