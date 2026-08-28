import { useState } from "react";
import { Table2 } from "lucide-react";
import { activityHeatmapWeeks, monthLabels, type ActivityCell } from "../history";
import type { Progress } from "../progress";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Same ramp as DailyHeatmap's — one hue, four steps — so the two calendars read as a pair. */
const FILL: Record<number, string> = {
  1: "var(--heat-1)",
  2: "var(--heat-2)",
  3: "var(--heat-3)",
  4: "var(--heat-4)",
};

function describe(cell: ActivityCell): string {
  const date = cell.date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (cell.future) return `${date} — not yet`;
  if (cell.count === 0) return `${date} — nothing solved`;
  return `${date} — ${cell.count} integral${cell.count === 1 ? "" : "s"} solved`;
}

function Cell({ cell, onActivate }: { cell: ActivityCell; onActivate: (cell: ActivityCell | null) => void }) {
  const interactive = cell.count > 0 && !cell.future;
  return (
    <div
      style={cell.count > 0 ? { backgroundColor: FILL[cell.level] } : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-hidden={interactive ? undefined : true}
      aria-label={interactive ? describe(cell) : undefined}
      onMouseEnter={() => interactive && onActivate(cell)}
      onMouseLeave={() => interactive && onActivate(null)}
      onFocus={() => interactive && onActivate(cell)}
      onBlur={() => interactive && onActivate(null)}
      className={`h-3 w-3 rounded-[3px] outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary sm:h-3.5 sm:w-3.5 ${
        cell.future ? "border border-dashed border-border/60" : cell.count > 0 ? "" : "bg-accent"
      }`}
    />
  );
}

/**
 * How much you actually did, one square per day — every daily/training/sprint solve counted,
 * regardless of whether that day's daily puzzle itself was won. Sits next to DailyHeatmap (which
 * grades the daily specifically) rather than replacing it: "did I show up and work" is a different
 * question from "how did today's puzzle go".
 */
export default function ActivityHeatmap({ progress, weeks = 18 }: { progress: Progress; weeks?: number }) {
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<ActivityCell | null>(null);
  const columns = activityHeatmapWeeks(progress, weeks);
  const months = monthLabels(columns);
  const activeDays = columns.flat().filter((c) => c.count > 0);
  const total = activeDays.reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold text-foreground">Integrals solved, last {weeks} weeks</h2>
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
            <caption className="sr-only">Every day you solved at least one integral</caption>
            <thead>
              <tr className="border-b border-border text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Day</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Solved</th>
              </tr>
            </thead>
            <tbody>
              {activeDays.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-muted-foreground">
                    Nothing yet — the first problem you solve lands here.
                  </td>
                </tr>
              )}
              {activeDays
                .slice()
                .reverse()
                .map((cell) => (
                  <tr key={cell.key} className="border-b border-border/50 last:border-0">
                    <td className="readout px-3 py-2 tabular-nums text-foreground">{cell.key}</td>
                    <td className="readout px-3 py-2 text-right tabular-nums text-foreground">{cell.count}</td>
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
              {total === 0 ? "Nothing solved yet." : `${total} solved over the last ${weeks} weeks. Hover or tab a day for the detail.`}
            </span>
          )}
        </p>
      )}

      {!asTable && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-[3px] bg-accent" /> none
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden>fewer</span>
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                aria-hidden
                className="h-3 w-3 rounded-[3px]"
                style={{ backgroundColor: FILL[level] }}
              />
            ))}
            <span aria-hidden>more</span>
          </span>
        </div>
      )}
    </div>
  );
}
