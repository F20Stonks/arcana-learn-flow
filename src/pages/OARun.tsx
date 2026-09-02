/**
 * Sitting one assessment: the briefing, the clock, and the review afterwards.
 *
 * The review is the half that matters. A score on its own tells a candidate they were slow, which
 * they already knew; every question is shown back with what they answered and why the answer is
 * what it is, because that is the only part of a practice run that changes the next one.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Clock, Play, RotateCcw, Square, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import ConfirmButton from "@/features/integrals/components/ConfirmButton";
import QuestionCard from "@/features/oa/components/QuestionCard";
import { FIRM_BY_ID, findAssessment } from "@/features/oa/firms";
import { assessmentShape } from "@/features/oa/generate";
import { answerText } from "@/features/oa/grade";
import { useAssessmentRun } from "@/features/oa/hooks/useAssessmentRun";
import { recordSitting } from "@/features/oa/progress";
import { FidelityNote } from "./OAHub";

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function OARun() {
  const { firmId = "", assessmentId = "" } = useParams();
  const firm = FIRM_BY_ID[firmId];
  const assessment = findAssessment(firmId, assessmentId);
  // A fresh paper per visit, and a number the candidate can see — a run is reproducible from it.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  if (!firm || !assessment) return <Navigate to="/oa" replace />;
  return (
    <Sitting
      key={seed}
      firmName={firm.name}
      firmId={firmId}
      assessment={assessment}
      seed={seed}
      onNewPaper={() => setSeed(Math.floor(Math.random() * 1e9))}
    />
  );
}

function Sitting({
  firmName,
  firmId,
  assessment,
  seed,
  onNewPaper,
}: {
  firmName: string;
  firmId: string;
  assessment: NonNullable<ReturnType<typeof findAssessment>>;
  seed: number;
  onNewPaper: () => void;
}) {
  const run = useAssessmentRun(assessment, seed);
  const shape = useMemo(() => assessmentShape(assessment), [assessment]);
  const section = assessment.sections[run.sectionIndex];
  const urgent = run.remaining <= 15 && run.status === "running";

  // Banked once, when the paper is finished — a run abandoned halfway still counts what it earned.
  useEffect(() => {
    if (run.result) recordSitting(run.result);
  }, [run.result]);

  // Leaving mid-paper loses the sitting; the clock does not pause for a reload.
  useEffect(() => {
    if (run.status !== "running") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [run.status]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        {run.status !== "running" && (
          <Link
            to={`/oa/${firmId}`}
            className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {firmName}
          </Link>
        )}

        {run.status === "briefing" && (
          <>
            <header className="reveal mb-6">
              <p className="text-[13px] uppercase tracking-[0.14em] text-muted-foreground">{firmName}</p>
              <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {assessment.name}
              </h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                {assessment.format}
              </p>
            </header>

            <section className="reveal mb-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <div className="readout text-[26px] font-semibold leading-none tabular-nums text-foreground">
                    {shape.questions}
                  </div>
                  <div className="mt-1.5 text-[12px] text-muted-foreground">questions</div>
                </div>
                <div>
                  <div className="readout text-[26px] font-semibold leading-none tabular-nums text-foreground">
                    {clock(shape.seconds)}
                  </div>
                  <div className="mt-1.5 text-[12px] text-muted-foreground">on the clock</div>
                </div>
                <div>
                  <div className="readout text-[26px] font-semibold leading-none tabular-nums text-foreground">
                    {(shape.seconds / shape.questions).toFixed(1)}s
                  </div>
                  <div className="mt-1.5 text-[12px] text-muted-foreground">per question</div>
                </div>
              </div>

              <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
                {assessment.sections.map((s, i) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
                    <span className="readout text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="readout tabular-nums text-muted-foreground">
                      {s.count} in {clock(s.seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="reveal mb-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                Before you start
              </h2>
              <ul className="flex flex-col gap-2">
                {assessment.rules.map((rule) => (
                  <li key={rule} className="flex gap-2.5 text-[13px] leading-relaxed">
                    {rule.includes("not simulated here") ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    )}
                    <span
                      className={
                        rule.includes("not simulated here") ? "text-amber-500" : "text-foreground"
                      }
                    >
                      {rule}
                    </span>
                  </li>
                ))}
                <li className="flex gap-2.5 text-[13px] leading-relaxed text-foreground">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  The clock starts the moment you press start, and each section's clock runs whether
                  or not you are answering. You cannot go back to a question.
                </li>
              </ul>
            </section>

            <FidelityNote className="reveal mb-6" />

            <button
              onClick={run.start}
              className="reveal flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Start · {clock(shape.seconds)}
            </button>
            <p className="reveal mt-3 text-[12px] text-muted-foreground">
              Paper <span className="readout tabular-nums">#{seed}</span> — the same number always
              builds the same paper.
            </p>
          </>
        )}

        {run.status === "running" && section && run.question && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">{section.name}</span>
                  <span className="readout ml-2 tabular-nums">
                    {run.questionIndex + 1}/{section.count}
                  </span>
                  {assessment.sections.length > 1 && (
                    <span className="readout ml-2 tabular-nums text-muted-foreground/60">
                      section {run.sectionIndex + 1}/{assessment.sections.length}
                    </span>
                  )}
                </span>
                <span
                  role="timer"
                  aria-live="off"
                  className={`readout flex items-center gap-1.5 text-[20px] font-semibold tabular-nums ${
                    urgent ? "text-destructive" : "text-foreground"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {clock(run.remaining)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${urgent ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.max(0, (run.remaining / section.seconds) * 100)}%` }}
                />
              </div>
              {/* The visible clock updates every second and is aria-live="off" for that reason;
                  these are the moments that actually change what a candidate does. */}
              <p className="sr-only" role="status" aria-live="polite">
                {[60, 30, 10].includes(run.remaining) ? `${run.remaining} seconds left in this section.` : ""}
              </p>
            </div>

            <QuestionCard
              question={run.question}
              value={run.input}
              onChange={run.setInput}
              onSubmit={run.submit}
              nonce={run.sectionIndex * 1000 + run.questionIndex}
            />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={run.skip}
                className="py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                Skip — it counts as wrong
              </button>
              <ConfirmButton
                onConfirm={run.end}
                confirmLabel="End the paper here?"
                icon={<Square className="h-3.5 w-3.5" />}
              >
                End paper
              </ConfirmButton>
            </div>
          </div>
        )}

        {run.status === "done" && run.result && (
          <Review
            result={run.result}
            firmName={firmName}
            onAgain={onNewPaper}
          />
        )}
      </main>
    </AppShell>
  );
}

function Review({
  result,
  firmName,
  onAgain,
}: {
  result: NonNullable<ReturnType<typeof useAssessmentRun>["result"]>;
  firmName: string;
  onAgain: () => void;
}) {
  const pct = Math.round(result.score * 100);
  const mark = result.assessment.reportedPassMark;
  const everything = useMemo(
    () => result.sections.flatMap((s) => s.attempts.map((a) => [s.section.id, a] as const)),
    [result],
  );
  const wrong = useMemo(() => everything.filter(([, a]) => !a.correct), [everything]);
  // Eighty questions with their working is not a list anyone reads. What you got wrong is.
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? everything : wrong;

  return (
    <div className="reveal flex flex-col gap-5">
      <header>
        <p className="text-[13px] uppercase tracking-[0.14em] text-muted-foreground">{firmName}</p>
        <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {result.assessment.name}
        </h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
          <div>
            <div className="readout text-[40px] font-bold leading-none tabular-nums text-primary">
              {result.correct}
              <span className="text-[22px] text-muted-foreground">/{result.total}</span>
            </div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">correct</div>
          </div>
          <div>
            <div className="readout text-[22px] font-semibold tabular-nums text-foreground">{pct}%</div>
            <div className="text-[12px] text-muted-foreground">of the paper</div>
          </div>
          <div>
            <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
              {clock(result.seconds)}
            </div>
            <div className="text-[12px] text-muted-foreground">spent</div>
          </div>
        </div>

        {mark !== undefined ? (
          <p className="mt-5 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
            {result.passed ? (
              <span className="font-medium text-primary">
                That clears the {Math.round(mark * 100)}% candidates commonly report as the bar.
              </span>
            ) : (
              <span>
                Candidates commonly report {Math.round(mark * 100)}% as the bar — that is{" "}
                {Math.ceil(mark * result.total) - result.correct} more.
              </span>
            )}{" "}
            It is a reported figure, not a published one, and it moves. Treat it as a target.
          </p>
        ) : (
          <p className="mt-5 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
            This firm does not publish a cutoff and candidates do not report a consistent one, so
            there is no pass mark here to measure yourself against — only your own last score.
          </p>
        )}
      </section>

      {result.sections.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-display text-[16px] font-semibold text-foreground">By section</h2>
          <ul className="flex flex-col gap-3">
            {result.sections.map((s) => (
              <li key={s.section.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-foreground">{s.section.name}</span>
                  <span className="readout tabular-nums text-muted-foreground">
                    {s.correct}/{s.section.count}
                    {s.unanswered > 0 && ` · ${s.unanswered} never reached`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={s.correct}
                  aria-valuemin={0}
                  aria-valuemax={s.section.count}
                  aria-label={`${s.section.name}: ${s.correct} of ${s.section.count} correct`}
                  className="h-2 w-full overflow-hidden rounded-[4px] bg-accent"
                >
                  <div
                    className="h-full rounded-r-[4px] bg-primary/70 transition-[width] duration-500"
                    style={{ width: `${(s.correct / s.section.count) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-[16px] font-semibold text-foreground">
            {showAll ? "Every question" : "What you missed"}
          </h2>
          {wrong.length !== everything.length && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="rounded-lg border border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {showAll
                ? `Just the ${wrong.length} you missed`
                : `Show all ${everything.length} answered`}
            </button>
          )}
        </div>
        <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
          The score tells you that you were slow. This tells you what to do about it.
        </p>
        {shown.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            {everything.length === 0
              ? "Nothing was answered, so there is nothing to go back over."
              : "Nothing missed — every question you reached, you got."}
          </p>
        ) : (
        <ol className="flex flex-col gap-4">
          {shown.map(([sectionId, attempt], i) => (
              <li
                key={`${sectionId}-${i}`}
                className="border-t border-border/60 pt-4 first:border-0 first:pt-0"
              >
                <div className="flex items-start gap-3">
                  {attempt.correct ? (
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <X className="mt-1 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="overflow-x-auto text-[14px] text-foreground">
                      <Tex>{attempt.question.prompt}</Tex>
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted-foreground">
                      {attempt.given === null ? (
                        <span className="text-muted-foreground/70">skipped</span>
                      ) : (
                        <>
                          you said{" "}
                          <span className="readout text-foreground">
                            {attempt.question.choices
                              ? (attempt.question.choices[Number(attempt.given)] ?? attempt.given)
                              : attempt.given}
                          </span>
                        </>
                      )}
                      {!attempt.correct && (
                        <>
                          {" · "}answer{" "}
                          <span className="readout text-foreground">
                            {answerText(attempt.question.answer, attempt.question.choices)}
                          </span>
                        </>
                      )}
                      {" · "}
                      <span className="readout tabular-nums">{(attempt.ms / 1000).toFixed(1)}s</span>
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground/90">
                      <Tex>{attempt.question.explanation}</Tex>
                    </p>
                  </div>
                </div>
              </li>
          ))}
        </ol>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onAgain}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> New paper
        </button>
      </div>
    </div>
  );
}
