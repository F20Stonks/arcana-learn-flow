/**
 * Training. Two screens sharing a file because they're two views of one thing: pick a technique,
 * then work it.
 *
 * The lesson comes before the drill on purpose. Students rarely fail an integral because they can't
 * execute a substitution — they fail because they don't know which of eight things to reach for, so
 * every lesson leads with the recognition cue rather than the recipe.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Layers, Shuffle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import RunPanel from "@/features/integrals/components/RunPanel";
import LessonBody from "@/features/integrals/components/LessonBody";
import { useIntegralRun } from "@/features/integrals/hooks/useIntegralRun";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { recordConceptRead } from "@/features/integrals/conceptReview";
import { markLessonRead, techniqueMastery } from "@/features/integrals/progress";
import { scheduledQueue } from "@/features/integrals/queue";
import { getAttempts } from "@/features/integrals/attempts";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import {
  DIFFICULTY_LABEL,
  PROBLEMS,
  problemsForSource,
  problemsForTechnique,
  problemsForTechniques,
  SOURCES,
  sourceKey,
} from "@/features/integrals/problems";
import type { Problem, ProblemSource, TechniqueId } from "@/features/integrals/types";

const MIXED = "mixed";
const CUSTOM = "custom";

/** Competitions worth their own uncurated set — "original" is the app's own pedagogical examples,
 * not a competition a student would want to drill "as it was set", so it's left off this list.
 * Sorted by name then year (not first-seen order, which just reflects mining order) so a
 * competition with several years — MIT's qualifying archive — lists chronologically. */
const COMPETITION_SOURCES = SOURCES.filter((s) => s.name !== "original").sort(
  (a, b) => a.name.localeCompare(b.name) || (a.year ?? 0) - (b.year ?? 0),
);

export default function IntegralTraining() {
  const progress = useProgress();
  const [customOpen, setCustomOpen] = useState(false);
  const [customSelection, setCustomSelection] = useState<Set<TechniqueId>>(new Set());

  const toggleCustom = (id: TechniqueId) => {
    setCustomSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppShell>
      <main className="relative mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Training
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            No clock pressure that matters, no streak at stake. Read the technique, then work through
            its problems — the queue puts what you haven't solved first. Counters below count solved
            problems only.{" "}
            <Link to="/integrals/lessons" className="text-foreground underline underline-offset-2">
              Read the lessons on their own
            </Link>
            .
          </p>
        </header>

        <div className="reveal grid gap-3 sm:grid-cols-2">
          {TECHNIQUES.map((t) => {
            const m = techniqueMastery(progress, t.id);
            return (
              <Link
                key={t.id}
                to={`/integrals/train/${t.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-[17px] font-semibold text-foreground">{t.name}</h2>
                  <span className="readout text-[12px] tabular-nums text-muted-foreground">
                    {m.solved}/{m.total}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                  <Tex>{t.tagline}</Tex>
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={m.solved}
                  aria-valuemin={0}
                  aria-valuemax={m.total}
                  aria-label={`${t.name}: ${m.solved} of ${m.total} solved`}
                  className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-accent"
                >
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                    style={{ width: `${Math.round(m.mastery * 100)}%` }}
                  />
                </div>
                {m.lessonRead && (
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Check className="h-3 w-3" /> lesson read
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            to={`/integrals/train/${MIXED}`}
            className="group rounded-2xl border border-dashed border-border bg-card/40 p-5 transition-colors hover:border-primary/40"
          >
            <Shuffle className="h-4 w-4 text-primary" />
            <h2 className="mt-3 font-display text-[17px] font-semibold text-foreground">Mixed practice</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Every problem in the bank, no label on the front. Recognising the technique unprompted is
              the whole skill.
            </p>
          </Link>
        </div>

        <section className="reveal mt-8 overflow-hidden rounded-2xl border border-dashed border-border bg-card/40">
          <button
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
            aria-controls="custom-mix-panel"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-display text-[16px] font-semibold text-foreground">Custom mix</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${customOpen ? "rotate-180" : ""}`}
            />
          </button>

          {customOpen && (
            <div id="custom-mix-panel" className="border-t border-border px-5 pb-5 pt-4">
              <p className="text-[13px] text-muted-foreground">
                Pick any subset of techniques to drill together — not just one at a time, not the whole
                bank.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TECHNIQUES.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground transition-colors hover:border-primary/40"
                  >
                    <input
                      type="checkbox"
                      checked={customSelection.has(t.id)}
                      onChange={() => toggleCustom(t.id)}
                      className="h-3.5 w-3.5 shrink-0 accent-primary"
                    />
                    {t.name}
                  </label>
                ))}
              </div>
              {customSelection.size > 0 ? (
                <Link
                  to={`/integrals/train/${CUSTOM}?techniques=${[...customSelection].join(",")}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Start ({customSelection.size} selected) <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p className="mt-4 text-[13px] text-muted-foreground">Select at least one technique.</p>
              )}
            </div>
          )}
        </section>

        {COMPETITION_SOURCES.length > 0 && (
          <section className="reveal mt-8">
            <h2 className="font-display text-[17px] font-semibold text-foreground">By source</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Work one competition's set exactly as it was set — uncurated, not sorted into techniques.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {COMPETITION_SOURCES.map((s) => {
                const count = problemsForSource(s).length;
                return (
                  <Link
                    key={sourceKey(s)}
                    to={`/integrals/train/source/${encodeURIComponent(sourceKey(s))}`}
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-[16px] font-semibold text-foreground">
                        {s.name}
                        {s.year && <span className="text-muted-foreground"> · {s.year}</span>}
                      </h3>
                      <span className="readout text-[12px] tabular-nums text-muted-foreground">
                        {count} problem{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    {s.round && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.round}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

// ── the practice screen ─────────────────────────────────────────────────────────────────────────

export function TrainingTechnique() {
  const { techniqueId = "", sourceKey: sourceKeyParam } = useParams();
  const [searchParams] = useSearchParams();
  const progress = useProgress();

  const isSource = sourceKeyParam !== undefined;
  const source: ProblemSource | undefined = isSource
    ? SOURCES.find((s) => sourceKey(s) === decodeURIComponent(sourceKeyParam))
    : undefined;
  const mixed = techniqueId === MIXED;
  const custom = techniqueId === CUSTOM;
  const technique = mixed || custom || isSource ? null : TECHNIQUE_BY_ID[techniqueId as TechniqueId];

  const customIds = useMemo(() => {
    if (!custom) return [];
    const raw = searchParams.get("techniques") ?? "";
    return raw.split(",").filter((id): id is TechniqueId => id in TECHNIQUE_BY_ID);
  }, [custom, searchParams]);

  const pool = useMemo(() => {
    if (isSource) return source ? problemsForSource(source) : [];
    if (mixed) return PROBLEMS;
    if (custom) return problemsForTechniques(customIds);
    return problemsForTechnique(techniqueId as TechniqueId);
  }, [isSource, source, mixed, custom, customIds, techniqueId]);

  // Deliberately seeded once, on mount: re-sorting as you solve would move the queue out from
  // under you. `scheduledQueue` (not the older `orderQueue`) is what makes a 70-day training block
  // adaptive rather than a walk through the bank in difficulty order — it reads the attempt log for
  // retention decay, per-technique weakness, near-miss priority and a target success band, then
  // interleaves so consecutive problems don't share a technique.
  const [queue] = useState(() => scheduledQueue(pool, progress, getAttempts()));
  const [index, setIndex] = useState(0);
  const [lessonOpen, setLessonOpen] = useState(false);

  const problem = queue[index];
  const run = useIntegralRun(problem ?? PROBLEMS[0]);

  const next = () => setIndex((i) => (i + 1) % queue.length);

  // After a correct answer the input is gone and the Next button is the only action. Let a quick
  // Enter press advance the queue without reaching for the mouse.
  // Every hook above the early returns below must run on every render regardless of which guard
  // fires, so this stays here rather than moving down next to where it reads naturally.
  useEffect(() => {
    if (run.status !== "solved") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setIndex((i) => (i + 1) % queue.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run.status, queue.length]);

  if (!mixed && !custom && !isSource && !technique) return <Navigate to="/integrals/train" replace />;
  if (isSource && !source) return <Navigate to="/integrals/train" replace />;
  if (!problem) return <Navigate to="/integrals/train" replace />;

  const openLesson = () => {
    setLessonOpen((v) => !v);
    if (!lessonOpen && technique) {
      markLessonRead(technique.id);
      recordConceptRead(technique.id);
    }
  };

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals/train"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All techniques
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {technique
              ? technique.name
              : custom
                ? "Custom mix"
                : source
                  ? `${source.name}${source.year ? ` · ${source.year}` : ""}`
                  : "Mixed practice"}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            <Tex>
              {technique
                ? technique.tagline
                : custom
                  ? `${customIds.length} technique${customIds.length === 1 ? "" : "s"} selected.`
                  : source
                    ? "This competition's set, worked exactly as it was set."
                    : "Every problem in the bank, technique unannounced."}
            </Tex>{" "}
            ·{" "}
            <span className="readout tabular-nums">
              {index + 1}/{queue.length}
            </span>{" "}
            · {DIFFICULTY_LABEL[problem.difficulty]}
          </p>
        </header>

        {technique && (
          <section className="reveal mb-6 overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={openLesson}
              aria-expanded={lessonOpen}
              aria-controls={`${technique.id}-lesson`}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/40"
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-display text-[16px] font-semibold text-foreground">The lesson</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${lessonOpen ? "rotate-180" : ""}`}
              />
            </button>

            {lessonOpen && (
              <div id={`${technique.id}-lesson`} className="border-t border-border px-5 pb-5 pt-4">
                <LessonBody technique={technique} />
              </div>
            )}
          </section>
        )}

        <RunPanel
          problem={problem}
          run={run}
          onSkip={next}
          footer={
            <div className="reveal flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <span className="text-[14px] text-foreground">
                {run.status === "solved" ? (
                  <>
                    Solved in {run.elapsed}s
                    {run.score && (
                      <span className="readout ml-2 font-semibold text-primary">+{run.score.total} XP</span>
                    )}
                  </>
                ) : (
                  "Have a read, then take the next one."
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={run.restart}
                  className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  Retry
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          }
        />
      </main>
    </AppShell>
  );
}
