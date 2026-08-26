import { difficultyBreakdown } from "../history";
import { DIFFICULTY_LABEL } from "../problems";
import type { Progress } from "../progress";

/**
 * How much of each difficulty you have cleared.
 *
 * One series, so one hue and no legend — the heading names it. The counts are direct-labelled
 * rather than left to the bar length, which is also what lets the fill sit at a tint of the
 * accent without leaning on contrast to be read.
 */
export default function DifficultyBars({ progress }: { progress: Progress }) {
  const rows = difficultyBreakdown(progress);

  return (
    <div>
      <h2 className="mb-4 font-display text-[17px] font-semibold text-foreground">Bank cleared</h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const fraction = row.total > 0 ? row.solved / row.total : 0;
          return (
            <li key={row.difficulty}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-foreground">
                  {DIFFICULTY_LABEL[row.difficulty]}
                  <span className="readout ml-2 text-[11px] text-muted-foreground">
                    level {row.difficulty}
                  </span>
                </span>
                <span className="readout text-[12px] tabular-nums text-muted-foreground">
                  {row.solved}/{row.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={row.solved}
                aria-valuemin={0}
                aria-valuemax={row.total}
                aria-label={`Level ${row.difficulty}: ${row.solved} of ${row.total} solved`}
                className="h-2 w-full overflow-hidden rounded-[4px] bg-accent"
              >
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-500"
                  style={{
                    width: `${Math.max(fraction > 0 ? 2 : 0, fraction * 100)}%`,
                    backgroundColor: "var(--heat-3)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
