/**
 * Training. Two screens sharing a file because they're two views of one thing: pick a technique,
 * then work it.
 *
 * The lesson comes before the drill on purpose. Students rarely fail an integral because they can't
 * execute a substitution — they fail because they don't know which technique to reach for, so
 * every lesson leads with the recognition cue rather than the recipe. That is also why an unread
 * lesson opens on arrival: a disclosure nobody opens is a lesson nobody reads.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  PartyPopper,
  RotateCcw,
  Shuffle,
  Target,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import RunPanel from "@/features/integrals/components/RunPanel";
import { useIntegralRun } from "@/features/integrals/hooks/useIntegralRun";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import {
  hasSolved,
  lastPlace,
  markLessonRead,
  markPlace,
  techniqueMastery,
} from "@/features/integrals/progress";
import { orderQueue } from "@/features/integrals/queue";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import { DIFFICULTY_LABEL, PROBLEMS, problemsForTechnique } from "@/features/integrals/problems";
import type { TechniqueId } from "@/features/integrals/types";

const MIXED = "mixed";

export default function IntegralTraining() {
  const progress = useProgress();

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
            No streak on the line, and you can retry anything as often as you like — though the
            clock still shapes the XP, so par is worth beating. Read the technique, then work
            through its problems: the queue puts what you haven't solved first, and remembers where
            you got to.
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
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{t.tagline}</p>
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
      </main>
    </AppShell>
  );
}

// ── the practice screen ─────────────────────────────────────────────────────────────────────────

export function TrainingTechnique() {
  const { techniqueId = "" } = useParams();
  const progress = useProgress();
  const mixed = techniqueId === MIXED;
  const technique = mixed ? null : TECHNIQUE_BY_ID[techniqueId as TechniqueId];

  const pool = useMemo(
    () => (mixed ? PROBLEMS : problemsForTechnique(techniqueId as TechniqueId)),
    [mixed, techniqueId],
  );
  // Deliberately seeded from progress once, on mount: re-sorting as you solve would move the queue
  // out from under you.
  const [queue] = useState(() => orderQueue(pool, progress));
  // Pick up where this queue was left. Stored as a problem id rather than an index, because the
  // order is re-derived from progress on every visit and an index would drift onto a different
  // problem between sessions.
  const [index, setIndex] = useState(() => {
    const at = queue.findIndex((p) => p.id === lastPlace(progress, techniqueId));
    return at === -1 ? 0 : at;
  });
  // The lesson leads, which only works if it is open. A technique you have already read collapses
  // out of the way instead.
  const [lessonOpen, setLessonOpen] = useState(() =>
    technique ? !progress.lessonsRead.includes(technique.id) : false,
  );
  const [finished, setFinished] = useState(false);

  const problem = queue[index];
  const run = useIntegralRun(problem ?? PROBLEMS[0], "training");
  const solvedHere = useMemo(
    () => queue.filter((p) => hasSolved(progress, p.id)).length,
    [queue, progress],
  );

  useEffect(() => {
    if (problem) markPlace(techniqueId, problem.id);
  }, [techniqueId, problem]);

  if (!mixed && !technique) return <Navigate to="/integrals/train" replace />;
  if (!problem) return <Navigate to="/integrals/train" replace />;

  // Read means read: recorded when the lesson is put away, not the instant it appears on screen.
  const toggleLesson = () => {
    if (lessonOpen && technique) markLessonRead(technique.id);
    setLessonOpen((v) => !v);
  };

  const last = index >= queue.length - 1;
  const next = () => (last ? setFinished(true) : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const goTo = (i: number) => {
    setFinished(false);
    setIndex(i);
  };
  // The queue is ordered unsolved-first at mount, but a session spent revisiting solved problems
  // leaves them scattered — so search forwards, then wrap.
  const unsolvedAfter = () => {
    const after = queue.findIndex((p, i) => i > index && !hasSolved(progress, p.id));
    if (after !== -1) return after;
    return queue.findIndex((p) => !hasSolved(progress, p.id));
  };

  if (finished) {
    const remaining = queue.length - solvedHere;
    return (
      <AppShell>
        <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <Link
            to="/integrals/train"
            className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All techniques
          </Link>

          <div className="reveal rounded-2xl border border-border bg-card p-6 sm:p-8">
            <PartyPopper className="h-5 w-5 text-primary" />
            <h1 className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              End of the {technique ? technique.name.toLowerCase() : "mixed"} queue
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {remaining === 0
                ? `Every one of the ${queue.length} problems here is beaten. Nothing left to take from this queue.`
                : `${solvedHere} of ${queue.length} solved — ${remaining} still standing.`}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {remaining > 0 && (
                <button
                  onClick={() => goTo(Math.max(0, unsolvedAfter()))}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Target className="h-4 w-4" /> Back to the unsolved
                </button>
              )}
              <button
                onClick={() => goTo(0)}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Start again from the top
              </button>
              <Link
                to="/integrals/train"
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Another technique
              </Link>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

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
            {technique ? technique.name : "Mixed practice"}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {technique ? technique.tagline : "Every problem in the bank, technique unannounced."} ·{" "}
            <span className="readout tabular-nums">
              {index + 1}/{queue.length}
            </span>{" "}
            · {DIFFICULTY_LABEL[problem.difficulty]}
          </p>

          {/* Where you are in the queue, as a line rather than a number you have to hold in your
              head. The two counts differ: position is where you are, solved is what you have beaten. */}
          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={solvedHere}
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-label={`${solvedHere} of ${queue.length} solved in this queue`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-accent"
            >
              <div
                className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
                style={{ width: `${Math.round((solvedHere / queue.length) * 100)}%` }}
              />
            </div>
            <span className="readout shrink-0 text-[12px] tabular-nums text-muted-foreground">
              {solvedHere}/{queue.length} solved
            </span>
          </div>
        </header>

        {technique && (
          <section className="reveal mb-6 overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={toggleLesson}
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
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  When to reach for it
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-foreground">
                  <Tex>{technique.whenToUse}</Tex>
                </p>

                <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  The recipe
                </h3>
                <ol className="mt-2 flex flex-col gap-2">
                  {technique.recipe.map((r, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-foreground">
                      <span className="readout mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <Tex>{r}</Tex>
                    </li>
                  ))}
                </ol>

                <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  Worked example
                </h3>
                <div className="mt-2 rounded-xl bg-accent/50 px-4 py-4">
                  <div className="overflow-x-auto text-center">
                    <Tex block className="text-foreground">{`\\int ${technique.example.integrand}\\,dx`}</Tex>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2">
                    {technique.example.work.map((w, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-foreground">
                        <Tex>{w}</Tex>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-border/60 pt-3 text-center">
                    <Tex className="text-foreground">{technique.example.result}</Tex>
                  </div>
                </div>

                <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  Where it goes wrong
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {technique.pitfalls.map((p, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <Tex>{p}</Tex>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <RunPanel
          problem={problem}
          run={run}
          onAdvance={next}
          advanceLabel={last ? "the wrap-up" : "the next problem"}
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

        {/* Moving around the queue, available whether or not the current run is over — landing on a
            problem you are not ready for used to mean the only way on was to solve it or reveal it. */}
        <nav className="reveal mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <button
            onClick={prev}
            disabled={index === 0}
            className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            onClick={() => {
              const i = unsolvedAfter();
              if (i !== -1) goTo(i);
            }}
            disabled={unsolvedAfter() === -1}
            className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Target className="h-3.5 w-3.5" /> Next unsolved
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip ahead <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      </main>
    </AppShell>
  );
}
