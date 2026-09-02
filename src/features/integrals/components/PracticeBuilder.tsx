import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, SlidersHorizontal, X } from "lucide-react";
import {
  allSources,
  applyFilter,
  describeFilter,
  filterToQuery,
  isEmptyFilter,
  type ProblemFilter,
} from "../filters";
import { DIFFICULTY_LABEL, PROBLEMS } from "../problems";
import { TECHNIQUES } from "../techniques";
import type { Difficulty, TechniqueId } from "../types";

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5];

function Chip({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        on
          ? "border-primary/60 bg-primary/[0.1] text-foreground"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className="readout ml-1.5 text-[11px] tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Toggle membership of a multi-select. Nothing selected means everything, never nothing. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Build a practice session out of any slice of the bank.
 *
 * Two independent filters rather than one, because they are two different requests. By technique,
 * multi-select — a student drilling parts *and* trig substitution together was previously stuck
 * taking one at a time or taking all 260 at once. By source — the same set a competition actually
 * posed, uncurated, which is the only way to rehearse the real thing. Difficulty cuts across both.
 *
 * The result is a URL, so a session someone has set up is a link they can keep or send on.
 */
export default function PracticeBuilder() {
  const [filter, setFilter] = useState<ProblemFilter>({ techniques: [], levels: [], sources: [] });
  const sources = useMemo(() => allSources(), []);
  const matches = useMemo(() => applyFilter(PROBLEMS, filter), [filter]);

  const set = <K extends keyof ProblemFilter>(key: K, value: ProblemFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  return (
    <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2.5">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <h2 className="font-display text-[17px] font-semibold text-foreground">Build a session</h2>
      </div>
      <p className="mb-5 text-[14px] leading-relaxed text-muted-foreground">
        Any slice of the bank: a handful of techniques together, one competition's set as it was
        posed, a difficulty band, or any combination. Leave a row untouched to take all of it.
      </p>

      <div className="flex flex-col gap-5">
        <Section title="Techniques">
          {TECHNIQUES.map((t) => (
            <Chip
              key={t.id}
              on={filter.techniques.includes(t.id)}
              onClick={() => set("techniques", toggle<TechniqueId>(filter.techniques, t.id))}
            >
              {t.name}
            </Chip>
          ))}
        </Section>

        <Section title="Difficulty">
          {LEVELS.map((level) => (
            <Chip
              key={level}
              on={filter.levels.includes(level)}
              onClick={() => set("levels", toggle<Difficulty>(filter.levels, level))}
            >
              {DIFFICULTY_LABEL[level]}
            </Chip>
          ))}
        </Section>

        {sources.length > 1 && (
          <Section title="Source">
            {sources.map((s) => (
              <Chip
                key={s.id}
                count={s.count}
                on={filter.sources.includes(s.id)}
                onClick={() => set("sources", toggle(filter.sources, s.id))}
              >
                {s.label}
              </Chip>
            ))}
          </Section>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <span className="text-[13px] text-muted-foreground" role="status">
          {describeFilter(filter, matches.length)}
        </span>
        <div className="flex items-center gap-2">
          {!isEmptyFilter(filter) && (
            <button
              type="button"
              onClick={() => setFilter({ techniques: [], levels: [], sources: [] })}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          {matches.length > 0 ? (
            <Link
              to={`/integrals/train/mixed${filterToQuery(filter)}`}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            // Better to say why than to hand over a queue with nothing in it.
            <span className="rounded-lg border border-border px-4 py-1.5 text-[13px] text-muted-foreground">
              Nothing matches
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
