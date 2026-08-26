import Tex from "./Tex";
import { integralLatex } from "../latex";
import { DIFFICULTY_LABEL } from "../problems";
import type { Problem } from "../types";

export function DifficultyStars({ level }: { level: Problem["difficulty"] }) {
  return (
    <span className="readout inline-flex items-center gap-1 text-[13px] tracking-[0.12em] text-primary">
      {"★".repeat(level)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - level)}</span>
    </span>
  );
}

export default function IntegralPrompt({ problem }: { problem: Problem }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-9 text-center">
      <div className="mb-5 flex items-center justify-center gap-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        <DifficultyStars level={problem.difficulty} />
        <span>{DIFFICULTY_LABEL[problem.difficulty]}</span>
      </div>
      <div className="overflow-x-auto px-2">
        <Tex block className="text-foreground">
          {integralLatex(problem)}
        </Tex>
      </div>
      {problem.kind === "definite" && (
        <p className="mt-4 text-[13px] text-muted-foreground">The answer is a number, not a function.</p>
      )}
    </div>
  );
}
