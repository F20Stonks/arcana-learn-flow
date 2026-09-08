/**
 * How points are earned, in plain sight.
 *
 * The formulas already live in `scoring.ts`; the problem was that a player only ever saw the final
 * number, so "why 214?" had no answer and the leaderboard felt arbitrary. This reads the real
 * constants rather than restating them, so the panel cannot drift from what is actually scored.
 */
import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { BASE_POINTS, PAR_SECONDS, nextHintCost } from "@/features/integrals/scoring";
import { DIFFICULTY_LABEL } from "@/features/integrals/problems";
import type { Difficulty } from "@/features/integrals/types";

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5];

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="readout shrink-0 text-[13px] font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function ScoringExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-display text-[16px] font-semibold text-foreground">How points work</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-5 px-5 pb-5">
          <div>
            <h3 className="mb-1 text-[13px] font-medium text-foreground">Starting points, by difficulty</h3>
            {LEVELS.map((d) => (
              <Line
                key={d}
                label={`${DIFFICULTY_LABEL[d]} · par ${PAR_SECONDS[d]}s`}
                value={`${BASE_POINTS[d]}`}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-[13px] font-medium text-foreground">What moves the number</h3>
            <Line label="Solve instantly" value="up to +50%" />
            <Line label="Take twice par or longer" value="no speed bonus" />
            <Line label="First hint" value={`−${Math.round(nextHintCost(0) * 100)}%`} />
            <Line label="Hints in total" value="never more than −60%" />
            <Line label="Each wrong answer" value="−10%, stopping at −30%" />
            <Line label="Daily streak" value="+5% a day, up to 1.5×" />
            <Line label="Training instead of the daily" value="half points" />
            <Line label="Re-solving a problem you've beaten" value="a quarter" />
            <Line label="Floor" value="5 points, always" />
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            The point of the halving and quartering is that the boards measure how well you know the
            techniques, not how many hours you had free. Beating a hard problem once, fast, is worth
            more than grinding an easy one all evening.
          </p>
        </div>
      )}
    </div>
  );
}
