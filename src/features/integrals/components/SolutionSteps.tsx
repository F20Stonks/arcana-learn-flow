import Tex from "./Tex";
import { TECHNIQUE_BY_ID } from "../techniques";
import type { Problem } from "../types";
import { Link } from "react-router-dom";

/** Shown once the run is over, win or lose — the point of the game is the technique, not the score. */
export default function SolutionSteps({ problem }: { problem: Problem }) {
  return (
    <div className="reveal rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[17px] font-semibold text-foreground">How it goes</h3>
        {problem.techniques.map((t) => (
          <Link
            key={t}
            to={`/integrals/train/${t}`}
            className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {TECHNIQUE_BY_ID[t]?.name ?? t}
          </Link>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {problem.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="readout mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-[14px] leading-relaxed text-foreground">
              <Tex>{step}</Tex>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-border pt-4">
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Answer</div>
        <div className="mt-2 overflow-x-auto">
          <Tex className="text-foreground">{problem.answerLatex}</Tex>
        </div>
      </div>
    </div>
  );
}
