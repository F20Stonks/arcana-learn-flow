/**
 * Drills — one question kind on repeat, graded in front of you.
 *
 * The gap this fills: the arena could only hand you whole papers, so a candidate who lost the
 * arithmetic section of an eighty-question sitting had to sit all eighty again to work on it.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock, Play, RotateCcw, Square, Target, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import ConfirmButton from "@/features/integrals/components/ConfirmButton";
import QuestionCard from "@/features/oa/components/QuestionCard";
import { answerText } from "@/features/oa/grade";
import { useDrillRun } from "@/features/oa/hooks/useDrillRun";
import {
  drillSeconds,
  drillToQuery,
  DRILL_LENGTHS,
  KINDS,
  KIND_BY_ID,
  parseDrill,
  type DrillConfig,
} from "@/features/oa/drill";
import { kindStandings, useOaProgress, weakestKind } from "@/features/oa/progress";
import { DIFFICULTY_WORD } from "@/features/oa/labels";

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function OADrill() {
  const [params, setParams] = useSearchParams();
  const config = useMemo(() => parseDrill(params), [params]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const run = useDrillRun(config, seed);
  const progress = useOaProgress();
  const standings = kindStandings(progress);
  const weakest = weakestKind(progress);
  const info = KIND_BY_ID[config.kind];

  const update = (next: Partial<DrillConfig>) => {
    const merged = { ...config, ...next };
    setParams(new URLSearchParams(drillToQuery(merged).slice(1)), { replace: true });
  };

  const standingFor = (kind: DrillConfig["kind"]) => standings.find((s) => s.kind === kind);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        {run.status !== "running" && (
          <Link
            to="/oa"
            className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> OA Arena
          </Link>
        )}

        {run.status === "ready" && (
          <>
            <header className="reveal mb-6">
              <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                Drills
              </h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                One question type on repeat, marked in front of you rather than at the end. A paper
                withholds the answer because it is measuring you; a drill is not, so it tells you
                while you can still do something with it.
              </p>
            </header>

            {weakest && weakest.kind !== config.kind && (
              <button
                onClick={() => update({ kind: weakest.kind })}
                className="reveal mb-5 flex w-full items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-left text-[13px] transition-colors hover:border-primary/50"
              >
                <Target className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground">
                  You are at{" "}
                  <span className="readout tabular-nums">{Math.round(weakest.accuracy * 100)}%</span>{" "}
                  on {KIND_BY_ID[weakest.kind].name.toLowerCase()} over {weakest.seen} questions —
                  your weakest. Drill that instead?
                </span>
              </button>
            )}

            <section className="reveal mb-5">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                Question type
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => {
                  const standing = standingFor(k.kind);
                  return (
                    <button
                      key={k.kind}
                      onClick={() => update({ kind: k.kind })}
                      aria-pressed={config.kind === k.kind}
                      className={`rounded-xl border p-3.5 text-left transition-colors ${
                        config.kind === k.kind
                          ? "border-primary/60 bg-primary/[0.07]"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-medium text-foreground">{k.name}</span>
                        {standing && (
                          <span className="readout text-[11px] tabular-nums text-muted-foreground">
                            {Math.round(standing.accuracy * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{k.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="reveal mb-5">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                Difficulty
              </h2>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => update({ level })}
                    aria-pressed={config.level === level}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] transition-colors ${
                      config.level === level
                        ? "border-primary/60 bg-primary/[0.07] text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {DIFFICULTY_WORD[level]}
                  </button>
                ))}
              </div>
            </section>

            <section className="reveal mb-6">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                Length and clock
              </h2>
              <div className="flex flex-wrap gap-2">
                {DRILL_LENGTHS.map((count) => (
                  <button
                    key={count}
                    onClick={() => update({ count })}
                    aria-pressed={config.count === count}
                    className={`readout rounded-lg border px-3.5 py-2 text-[13px] tabular-nums transition-colors ${
                      config.count === count
                        ? "border-primary/60 bg-primary/[0.07] text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {count}
                  </button>
                ))}
                <button
                  onClick={() =>
                    update({
                      seconds:
                        config.seconds === null
                          ? drillSeconds({ kind: config.kind, level: config.level, count: config.count })
                          : null,
                    })
                  }
                  aria-pressed={config.seconds !== null}
                  className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] transition-colors ${
                    config.seconds !== null
                      ? "border-primary/60 bg-primary/[0.07] text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {config.seconds === null
                    ? "Untimed"
                    : clock(drillSeconds({ kind: config.kind, level: config.level, count: config.count }))}
                </button>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                {config.seconds === null
                  ? "Untimed while you are still learning what the question asks. The clock is the point in a real sitting, and noise before that."
                  : `About ${info.pace}s a question, which is roughly what a real screen allows for this type.`}
              </p>
            </section>

            <button
              onClick={run.start}
              className="reveal flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Start · {config.count} {info.name.toLowerCase()}
            </button>
          </>
        )}

        {run.status === "running" && run.question && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">{info.name}</span>
                <span className="readout ml-2 tabular-nums">
                  {run.index + 1}/{config.count}
                </span>
                <span className="readout ml-2 tabular-nums text-muted-foreground/60">
                  {run.correct} right
                </span>
              </span>
              {run.remaining !== null && (
                <span
                  role="timer"
                  aria-live="off"
                  className={`readout flex items-center gap-1.5 text-[18px] font-semibold tabular-nums ${
                    run.remaining <= 15 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {clock(run.remaining)}
                </span>
              )}
            </div>

            <QuestionCard
              question={run.question}
              value={run.input}
              onChange={run.setInput}
              onSubmit={run.verdict ? run.next : run.submit}
              nonce={run.index}
              submitLabel="Check"
              locked={run.verdict !== null}
            />

            {/* The whole difference between a drill and a sitting lives here. */}
            <div role="status" aria-live="polite" className="min-h-[24px]">
              {run.verdict && (
                <div className="reveal rounded-xl border border-border bg-card px-4 py-3.5">
                  <p
                    className={`flex items-center gap-2 text-[14px] font-medium ${
                      run.verdict.correct ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {run.verdict.correct ? (
                      <>
                        <Check className="h-4 w-4" /> Correct.
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" /> Not this one — the answer is{" "}
                        <span className="readout">
                          {answerText(run.question.answer, run.question.choices)}
                        </span>
                        .
                      </>
                    )}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    <Tex>{run.question.explanation}</Tex>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              {run.verdict ? (
                <button
                  onClick={run.next}
                  autoFocus
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Next question <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={run.next}
                  className="py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  Skip — it counts as wrong
                </button>
              )}
              <ConfirmButton
                onConfirm={run.end}
                confirmLabel="Stop the drill?"
                icon={<Square className="h-3.5 w-3.5" />}
              >
                End drill
              </ConfirmButton>
            </div>
          </div>
        )}

        {run.status === "done" && (
          <div className="reveal flex flex-col gap-5">
            <header>
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {run.correct}/{run.attempts.length} on {info.name.toLowerCase()}
              </h1>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {DIFFICULTY_WORD[config.level]} ·{" "}
                {run.attempts.length > 0
                  ? `${(run.attempts.reduce((n, a) => n + a.ms, 0) / run.attempts.length / 1000).toFixed(1)}s a question`
                  : "nothing attempted"}
              </p>
            </header>

            {run.attempts.some((a) => !a.correct) && (
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="mb-4 font-display text-[16px] font-semibold text-foreground">
                  What you missed
                </h2>
                <ol className="flex flex-col gap-4">
                  {run.attempts
                    .filter((a) => !a.correct)
                    .map((attempt, i) => (
                      <li key={i} className="border-t border-border/60 pt-4 first:border-0 first:pt-0">
                        <div className="overflow-x-auto text-[14px] text-foreground">
                          <Tex>{attempt.question.prompt}</Tex>
                        </div>
                        <p className="mt-1.5 text-[13px] text-muted-foreground">
                          {attempt.given === null ? (
                            <span className="text-muted-foreground/70">skipped</span>
                          ) : (
                            <>
                              you said <span className="readout text-foreground">{attempt.given}</span>
                            </>
                          )}
                          {" · "}answer{" "}
                          <span className="readout text-foreground">
                            {answerText(attempt.question.answer, attempt.question.choices)}
                          </span>
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground/90">
                          <Tex>{attempt.question.explanation}</Tex>
                        </p>
                      </li>
                    ))}
                </ol>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSeed(Math.floor(Math.random() * 1e9));
                  run.start();
                }}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" /> Another set
              </button>
              <Link
                to="/oa"
                className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Back to the firms
              </Link>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
