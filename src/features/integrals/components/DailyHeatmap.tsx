import { useState } from "react";
import { Table2 } from "lucide-react";
import { heatmapWeeks, monthLabels, type DayCell } from "../history";
import { formatDuration } from "../scoring";
import type { Progress } from "../progress";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Steps of the sequential ramp declared in index.css; index 0 is "nothing banked". */
const FILL: Record<number, string> = {
  1: "var(--heat-1)",
  2: "var(--heat-2)",
  3: "var(--heat-3)",
  4: "var(--heat-4)",
};

function describe(cell: DayCell): string {
  const date = cell.date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (cell.future) return `${date} — not yet`;
  if (!cell.attempted) return `${date} — no attempt`;
  if (!cell.solved) return `${date} — attempted, not solved`;
  return `${date} — solved, ${cell.score} points in ${formatDuration(cell.record?.seconds ?? 0)}`;
}

function Cell({
  cell,
  onActivate,
}: {
  cell: DayCell;
  onActivate: (cell: DayCell | null) => void;
}) {
  const interactive = cell.attempted && !cell.future;

  // Attempted-but-unsolved is a ring rather than a fill, so it never depends on colour alone
  // to separate it from a dim solve.
  const style = cell.solved
    ? { backgroundColor: FILL[cell.level] }
    : cell.attempted
      ? { boxShadow: "inset 0 0 0 1.5px color-mix(in oklab, var(--destructive) 70%, transparent)" }
      : undefined;

  return (
    <div
      style={style}
      tabIndex={interactive ? 0 : undefined}
      aria-hidden={interactive ? undefined : true}
      aria-label={interactive ? describe(cell) : undefined}
      onMouseEnter={() => interactive && onActivate(cell)}
      onMouseLeave={() => interactive && onActivate(null)}
      onFocus={() => interactive && onActivate(cell)}
      onBlur={() => interactive && onActivate(null)}
      className={`h-3 w-3 rounded-[3px] outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary sm:h-3.5 sm:w-3.5 ${
        cell.future ? "border border-dashed border-border/60" : cell.attempted ? "" : "bg-accent"
      }`}
    />
  );
}

/**
 * The daily calendar.
 *
 * A sequential ramp — one hue, four steps — where brightness is how the day went against par
 * rather than the raw score, because the daily ramps in difficulty across the week and a perfect
 * Monday would otherwise look worse than a scraped Saturday.
 *
 * The dim end of the ramp sits under 3:1 against the surface, so this ships the relief that
 * requires: every cell carries its own label, and the same data is available as a table.
 */
export default function DailyHeatmap({ progress, weeks = 18 }: { progress: Progress; weeks?: number }) {
  const [asTable, setAsTable] = useState(false);
  // The detail line lives under the grid rather than floating over the cell: the calendar scrolls
  // sideways on a narrow screen, and anything positioned inside a scroll container gets clipped by
  // it. A fixed line also gives keyboard users somewhere for focus to be announced.
  const [active, setActive] = useState<DayCell | null>(null);
  const columns = heatmapWeeks(progress, weeks);
  const months = monthLabels(columns);
  const played = columns.flat().filter((c) => c.attempted);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold text-foreground">Daily results, last {weeks} weeks</h2>
        <button
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Table2 className="h-3.5 w-3.5" /> {asTable ? "Calendar" : "Table"}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Every day you have attempted the daily integral</caption>
            <thead>
              <tr className="border-b border-border text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Day</th>
                <th scope="col" className="px-3 py-2 font-medium">Result</th>
                <th scope="col" className="px-3 py-2 font-medium">Time</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {played.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    Nothing yet — the first daily you play lands here.
                  </td>
                </tr>
              )}
              {played
                .slice()
                .reverse()
                .map((cell) => (
                  <tr key={cell.key} className="border-b border-border/50 last:border-0">
                    <td className="readout px-3 py-2 tabular-nums text-foreground">{cell.key}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {cell.solved ? "Solved" : "Not solved"}
                    </td>
                    <td className="readout px-3 py-2 tabular-nums text-muted-foreground">
                      {formatDuration(cell.record?.seconds ?? 0)}
                    </td>
                    <td className="readout px-3 py-2 text-right tabular-nums text-foreground">
                      {cell.score}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-1">
            <div className="flex w-8 shrink-0 flex-col gap-1 pr-1 pt-[15px]">
              {WEEKDAYS.map((day, i) => (
                <span
                  key={day}
                  aria-hidden
                  className="flex h-3 items-center text-[10px] leading-none text-muted-foreground/70 sm:h-3.5"
                >
                  {i % 2 === 1 ? day : ""}
                </span>
              ))}
            </div>
            <div>
              {/* Laid out as a row of column-width cells rather than positioned by pixel offset,
                  so the labels stay aligned when the cell size changes at the sm breakpoint. */}
              <div className="mb-1 flex gap-1">
                {columns.map((_, i) => (
                  <span key={i} aria-hidden className="relative h-3 w-3 sm:w-3.5">
                    {months.find((m) => m.index === i) && (
                      <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground/70">
                        {months.find((m) => m.index === i)!.label}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                {columns.map((column, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    {column.map((cell) => (
                      <Cell key={cell.key} cell={cell} onActivate={setActive} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!asTable && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-[18px] text-[12px] leading-[18px] text-foreground"
        >
          {active ? (
            describe(active)
          ) : (
            <span className="text-muted-foreground/70">
              {played.length === 0
                ? "No dailies played yet."
                : "Hover or tab a day for the detail."}
            </span>
          )}
        </p>
      )}

      {!asTable && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-[3px] bg-accent" /> no attempt
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-3 rounded-[3px]"
              style={{ boxShadow: "inset 0 0 0 1.5px color-mix(in oklab, var(--destructive) 70%, transparent)" }}
            />
            not solved
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden>below par</span>
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                aria-hidden
                className="h-3 w-3 rounded-[3px]"
                style={{ backgroundColor: FILL[level] }}
              />
            ))}
            <span aria-hidden>above</span>
          </span>
        </div>
      )}
    </div>
  );
}
