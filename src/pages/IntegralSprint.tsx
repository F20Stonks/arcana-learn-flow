/**
 * Sprint — as many integrals as you can before the clock runs out.
 *
 * The daily is one problem you think about and training is one technique you work through. Neither
 * is the thing you play twice in a row; this is. Pick a band and a clock, and the only question is
 * how many you land.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Eye, Play, RotateCcw, SkipForward, Square, Trophy } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import AnswerInput from "@/features/integrals/components/AnswerInput";
import VerdictLine from "@/features/integrals/components/VerdictLine";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import ConfirmButton from "@/features/integrals/components/ConfirmButton";
import { integralLatex } from "@/features/integrals/latex";
import { useSprintRun } from "@/features/integrals/hooks/useSprintRun";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { sprintBest } from "@/features/integrals/progress";
import {
  BANDS,
  BAND_BY_ID,
  DURATIONS,
  describeConfig,
  rememberSetup,
  sprintRate,
  storedSetup,
  SKIP_PENALTY,
  type BandId,
  type Duration,
} from "@/features/integrals/sprint";
import { DIFFICULTY_LABEL } from "@/features/integrals/problems";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";

function durationLabel(seconds: Duration): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}

export default function IntegralSprint() {
  const [band, setBand] = useState<BandId>(() => storedSetup().band);
  const [seconds, setSeconds] = useState<Duration>(() => storedSetup().seconds);
  const config = useMemo(() => ({ band, seconds }), [band, seconds]);
  const run = useSprintRun(config);
  const progress = useProgress();
  const best = sprintBest(progress, config);

  const fraction = run.remaining / config.seconds;
  const urgent = run.remaining <= 10 && run.status === "running";
  const running = run.status === "running";

  useEffect(() => rememberSetup({ band, seconds }), [band, seconds]);

  // Solves bank as they happen, but the run's score and its personal best only exist at the end,
  // so a reload halfway through throws away the run itself.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  // The visible clock is `aria-live="off"` — announcing every second would be unusable. These are
  // the moments that actually change what you do, and they are all a sighted player gets from
  // watching the bar drain.
  const mark = running ? [60, 30, 10].find((t) => run.remaining === t) : undefined;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        {run.status === "ready" && (
          <>
            <header className="reveal mb-7">
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                Sprint
              </h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                As many as you can before the clock runs out. Harder problems are worth more; skipping
                costs {SKIP_PENALTY} points.
              </p>
            </header>

            <section className="reveal mb-5">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Band</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {BANDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBand(b.id)}
                    aria-pressed={band === b.id}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      band === b.id
                        ? "border-primary/60 bg-primary/[0.07]"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[15px] font-semibold text-foreground">{b.name}</span>
                      <span className="readout text-[11px] tabular-nums text-muted-foreground">
                        Levels {b.difficulties[0]}–{b.difficulties[b.difficulties.length - 1]}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{b.blurb}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="reveal mb-6">
              <h2 className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Clock</h2>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSeconds(d)}
                    aria-pressed={seconds === d}
                    className={`readout rounded-lg border px-4 py-2 text-[14px] tabular-nums transition-colors ${
                      seconds === d
                        ? "border-primary/60 bg-primary/[0.07] text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {durationLabel(d)}
                  </button>
                ))}
              </div>
            </section>

            <div className="reveal flex flex-wrap items-center gap-4">
              <button
                onClick={run.start}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Play className="h-4 w-4" /> Start {describeConfig(config)}
              </button>
              {best ? (
                <span className="readout flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Best {best.score} · {best.solved} solved · {best.runs}{" "}
                  {best.runs === 1 ? "run" : "runs"}
                </span>
              ) : (
                <span className="text-[13px] text-muted-foreground">No run at this setting yet.</span>
              )}
            </div>
          </>
        )}

        {run.status === "running" && run.problem && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span
                  className={`readout text-[22px] font-semibold tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}
                  role="timer"
                  aria-live="off"
                >
                  {Math.floor(run.remaining / 60)}:{String(run.remaining % 60).padStart(2, "0")}
                </span>
                <span className="readout text-[14px] tabular-nums text-muted-foreground">
                  {run.solved.length} solved · {run.liveScore} pts
                </span>
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {mark ? `${mark} seconds left.` : ""}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${urgent ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.max(0, fraction * 100)}%` }}
                />
              </div>
            </div>

            {/* The only confirmation a correct answer gets. The queue advances the instant you
                land one, so without this the screen just silently changes under you. Always
                mounted, because a live region that appears with its text is a region screen
                readers skip. */}
            <div role="status" aria-live="polite" aria-label="Last solve" className="min-h-[30px]">
              {run.landed && (
                <div
                  key={run.landed.nonce}
                  className="reveal flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2 text-[13px]"
                >
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Check className="h-3.5 w-3.5" /> Landed
                  </span>
                  <span className="min-w-0 flex-1 overflow-x-auto text-foreground">
                    <Tex>{integralLatex(run.landed.problem)}</Tex>
                  </span>
                  <span className="readout shrink-0 font-semibold tabular-nums text-primary">
                    +{run.landed.points}
                  </span>
                </div>
              )}
            </div>

            <IntegralPrompt problem={run.problem} />

            <AnswerInput
              value={run.input}
              onChange={run.setInput}
              onSubmit={run.submit}
              verdict={run.verdict}
              problem={run.problem}
            />
            <VerdictLine verdict={run.verdict} />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={run.skip}
                className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <SkipForward className="h-3.5 w-3.5" /> Skip · −{SKIP_PENALTY}
              </button>
              <ConfirmButton
                onConfirm={run.end}
                confirmLabel="Stop the clock?"
                icon={<Square className="h-3.5 w-3.5" />}
              >
                End run
              </ConfirmButton>
            </div>
          </div>
        )}

        {run.status === "done" && run.result && (
          <div className="reveal flex flex-col gap-5">
            <header>
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                Time.
              </h1>
              <p className="mt-1 text-[14px] text-muted-foreground">{describeConfig(config)}</p>
            </header>

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
                <div>
                  <div className="readout text-[40px] font-bold leading-none tabular-nums text-primary">
                    {run.result.score}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">points</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {run.result.solved.length}
                  </div>
                  <div className="text-[12px] text-muted-foreground">solved</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                    {sprintRate(run.result)}
                  </div>
                  <div className="text-[12px] text-muted-foreground">per minute</div>
                </div>
                <div>
                  <div className="readout text-[22px] font-semibold tabular-nums text-muted-foreground">
                    {run.result.skipped}
                  </div>
                  <div className="text-[12px] text-muted-foreground">skipped</div>
                </div>
              </div>

              {best && (
                <p className="mt-5 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  {run.result.score >= best.score ? (
                    <span className="font-medium text-primary">
                      New best at {BAND_BY_ID[config.band].name} · {durationLabel(config.seconds)}.
                    </span>
                  ) : (
                    <span>
                      Best is {best.score} — {best.score - run.result.score} short.
                    </span>
                  )}
                </p>
              )}
            </div>

            {run.result.solved.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="mb-3 font-display text-[16px] font-semibold text-foreground">
                  What you landed
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {run.result.solved.map((p, i) => (
                    <li key={`${p.id}-${i}`} className="flex items-start gap-3">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 overflow-x-auto text-[14px] text-foreground">
                        <Tex>{integralLatex(p)}</Tex>
                      </span>
                      <span className="readout shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {DIFFICULTY_LABEL[p.difficulty]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {run.result.missed.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-1 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display text-[16px] font-semibold text-foreground">
                    What got away
                  </h2>
                </div>
                <p className="mb-4 text-[13px] text-muted-foreground">
                  Skipped, or still on screen when the clock stopped. Answers shown — a sprint you
                  learn nothing from is just a typing test.
                </p>
                <ul className="flex flex-col gap-3.5">
                  {run.result.missed.map((p, i) => (
                    <li key={`${p.id}-${i}`} className="border-t border-border/60 pt-3.5 first:border-0 first:pt-0">
                      <div className="flex items-start gap-3">
                        <span className="min-w-0 flex-1 overflow-x-auto text-[14px] text-foreground">
                          <Tex>{integralLatex(p)}</Tex>
                        </span>
                        <span className="readout shrink-0 text-[12px] tabular-nums text-muted-foreground">
                          {DIFFICULTY_LABEL[p.difficulty]}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="overflow-x-auto text-[14px] text-muted-foreground">
                          = <Tex className="text-foreground">{p.answerLatex}</Tex>
                        </span>
                        <Link
                          to={`/integrals/train/${p.techniques[0]}`}
                          className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          Drill {TECHNIQUE_BY_ID[p.techniques[0]]?.name ?? p.techniques[0]} →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={run.start}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" /> Again
              </button>
              <button
                onClick={run.reset}
                className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Change setup
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
