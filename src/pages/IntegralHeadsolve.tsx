/**
 * Headsolve mode (WS-9, UK_BEE_BURST.md Extension 2) — think time, uncontaminated by typing.
 *
 * Every other clock in this app measures mathematics plus typing. This one measures neither
 * separately — there is no answer input at all. A problem appears, you think, one keypress stops
 * the clock the instant you have it, the reference answer reveals, and you self-grade got it /
 * close / no. Nothing is typed, so nothing needs parsing: self-grading is the only honest option
 * here, not a compromise — you're training alone and have no incentive to flatter yourself.
 *
 * Keyboard-first throughout, since the whole point is speed: Space stops the clock; 1 / 2 / 3 (or
 * G / C / N) grade it once revealed.
 */
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Flame, Minus, Timer, X, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import SolutionSteps from "@/features/integrals/components/SolutionSteps";
import { useHeadsolveRun, type HeadsolveRunApi } from "@/features/integrals/hooks/useHeadsolveRun";
import { useHeadsolveAttempts, useHeadsolveLadder } from "@/features/integrals/hooks/useHeadsolveHistory";
import {
  HEADSOLVE_BAND_LABEL,
  LEVEL_COUNT,
  SUCCESS_STREAK_TO_LEVEL_UP,
  headsolveBand,
  summarizeHeadsolve,
  type HeadsolveGrade,
} from "@/features/integrals/headsolve";

function secondsLabel(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

const GRADE_LABEL: Record<HeadsolveGrade, string> = { "got-it": "Got it", close: "Close", no: "No" };
const GRADE_KEY: Record<HeadsolveGrade, string> = { "got-it": "1", close: "2", no: "3" };

export default function IntegralHeadsolve() {
  const run = useHeadsolveRun();

  if (run.status === "ready") return <HeadsolveLanding onStart={run.start} />;
  if (run.status === "revealed") return <HeadsolveRunning run={run} revealed />;
  return <HeadsolveRunning run={run} revealed={false} />;
}

// ── shared header ──────────────────────────────────────────────────────────────────────────────

function LadderStatus({ ladder, streakGoal }: { ladder: HeadsolveRunApi["ladder"]; streakGoal: number }) {
  return (
    <span className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <span>
        Level <span className="readout font-semibold text-foreground">{ladder.level + 1}</span> of{" "}
        {LEVEL_COUNT}
      </span>
      <span className="flex items-center gap-1">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="readout font-semibold text-foreground">{ladder.streak}</span>
        <span>/ {streakGoal} streak</span>
      </span>
    </span>
  );
}

// ── ready ──────────────────────────────────────────────────────────────────────────────────────

function HeadsolveLanding({ onStart }: { onStart: () => void }) {
  const attempts = useHeadsolveAttempts();
  const ladder = useHeadsolveLadder();
  const summary = useMemo(() => summarizeHeadsolve(attempts), [attempts]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-7">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Headsolve
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            No typing. An integral appears, you think, one key stops the clock the instant you have
            it, the answer reveals and you grade yourself — got it, close, or no. Only think time
            counts, because that's the only number a written competition actually cares about.
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Ladder</div>
            <LadderStatus ladder={ladder} streakGoal={SUCCESS_STREAK_TO_LEVEL_UP} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {SUCCESS_STREAK_TO_LEVEL_UP} clean solves in a row climbs a level; a miss drops one. The
            ladder starts with symmetry collapses and memorised results, and works up toward heavier
            multi-step techniques as you prove you're fast on what came before.
          </p>
        </section>

        {summary.total > 0 && (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">All-time</div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <div className="readout text-[26px] font-semibold tabular-nums text-foreground">
                  {secondsLabel(summary.medianThinkMs ?? 0)}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">median think time · {summary.total} graded</div>
              </div>
              <div>
                <div className="readout text-[26px] font-semibold tabular-nums text-foreground">
                  {Math.round((summary.gotIt / summary.total) * 100)}%
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">got it clean</div>
              </div>
              {summary.beatTargetRate !== null && (
                <div>
                  <div className="readout text-[26px] font-semibold tabular-nums text-foreground">
                    {Math.round(summary.beatTargetRate * 100)}%
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">beat the band's target</div>
                </div>
              )}
            </div>
          </section>
        )}

        <button
          onClick={onStart}
          className="reveal flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Zap className="h-4 w-4" /> Start
        </button>
      </main>
    </AppShell>
  );
}

// ── running (thinking + revealed) ─────────────────────────────────────────────────────────────

function HeadsolveRunning({ run, revealed }: { run: HeadsolveRunApi; revealed: boolean }) {
  const { problem } = run;

  // Space stops the clock while thinking; 1/2/3 and G/C/N grade once revealed. Guarded against a
  // focused input/textarea/select, same convention as IntegralTraining.tsx / IntegralValues.tsx —
  // this page has no text field of its own, but the guard costs nothing and keeps the convention.
  // Depends on the two stable, useCallback-memoized handlers specifically (not the whole `run`
  // object, which is a fresh literal every render — including every 100ms clock tick while
  // thinking, which would otherwise tear down and re-add this listener ten times a second).
  const { stopClock, gradeSelf } = run;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
        return;
      }
      if (!revealed && e.key === " ") {
        e.preventDefault();
        stopClock();
        return;
      }
      if (revealed) {
        const key = e.key.toLowerCase();
        if (key === "1" || key === "g") gradeSelf("got-it");
        else if (key === "2" || key === "c") gradeSelf("close");
        else if (key === "3" || key === "n") gradeSelf("no");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stopClock, gradeSelf, revealed]);

  if (!problem) return null;

  const band = headsolveBand(problem);
  const overTarget = !revealed && run.targetMs !== null && run.elapsedMs > run.targetMs;
  const clockMs = revealed ? (run.thinkMs ?? run.elapsedMs) : run.elapsedMs;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="reveal mb-5 flex flex-wrap items-center justify-between gap-3">
          <LadderStatus ladder={run.ladder} streakGoal={SUCCESS_STREAK_TO_LEVEL_UP} />
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span>
              {run.sessionGotIt}/{run.sessionCount} this session
            </span>
            <button onClick={run.finish} className="transition-colors hover:text-foreground">
              Stop
            </button>
          </div>
        </div>

        <div className="reveal mb-5 flex items-center justify-between text-[13px] text-muted-foreground">
          <span
            role="timer"
            aria-live="off"
            className={`readout flex items-center gap-1.5 text-[22px] font-semibold tabular-nums ${overTarget ? "text-destructive" : "text-foreground"}`}
          >
            <Timer className="h-4 w-4" /> {secondsLabel(clockMs)}
          </span>
          <span>
            {HEADSOLVE_BAND_LABEL[band]}
            {run.targetMs !== null ? (
              <>
                {" "}
                · target <span className="readout font-medium text-foreground">{secondsLabel(run.targetMs)}</span>
              </>
            ) : (
              " · no fixed target"
            )}
          </span>
        </div>

        <div className="reveal mb-6">
          <IntegralPrompt problem={problem} />
        </div>

        {!revealed && (
          <button
            onClick={run.stopClock}
            className="reveal flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-[16px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Got it — stop the clock
            <kbd className="rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 text-[11px] font-normal">
              Space
            </kbd>
          </button>
        )}

        {revealed && (
          <>
            <div className="reveal mb-6 flex items-center justify-center gap-2 text-[14px]">
              {run.beat === true && (
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Check className="h-4 w-4" /> Beat the target
                </span>
              )}
              {run.beat === false && (
                <span className="flex items-center gap-1.5 font-medium text-destructive">
                  <X className="h-4 w-4" /> Over the target
                </span>
              )}
              {run.beat === null && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Minus className="h-4 w-4" /> No fixed target for this band
                </span>
              )}
            </div>

            <div className="reveal mb-6">
              <SolutionSteps problem={problem} />
            </div>

            <div className="reveal grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["got-it", "close", "no"] as HeadsolveGrade[]).map((grade) => (
                <button
                  key={grade}
                  onClick={() => run.gradeSelf(grade)}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-[14px] font-medium transition-colors ${
                    grade === "got-it"
                      ? "border-primary/50 text-primary hover:bg-primary/[0.08]"
                      : grade === "no"
                        ? "border-destructive/40 text-destructive hover:bg-destructive/[0.06]"
                        : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {GRADE_LABEL[grade]}
                  <kbd className="rounded border border-current/30 px-1.5 py-0.5 text-[11px] opacity-70">
                    {GRADE_KEY[grade]}
                  </kbd>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

