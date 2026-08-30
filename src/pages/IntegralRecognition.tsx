/**
 * Name the weapon — the recognition drill (WS-6, UK_BEE_BURST.md).
 *
 * The accessible ten in a real Round 1 sitting need to land in ~90 seconds each, and picking the
 * right technique on sight is a big share of that budget. This isolates exactly that skill: the
 * integrand, four technique buttons, a ~3s clock, no solving. Every problem is already tagged, so
 * this needs zero new content — just a different, faster lens on the same bank.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw, Timer, X, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import { integralLatex } from "@/features/integrals/latex";
import { useRecognitionRun, type RecognitionRunApi } from "@/features/integrals/hooks/useRecognitionRun";
import { useRecognitionAttempts } from "@/features/integrals/hooks/useRecognitionAttempts";
import {
  RECOGNITION_ROUND_LENGTH,
  RECOGNITION_TIME_LIMIT_MS,
  summarize,
  type TechniqueRecognitionStats,
} from "@/features/integrals/recognition";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import type { TechniqueId } from "@/features/integrals/types";

function msLabel(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

/** The lowest-accuracy technique with at least a few picks behind it — one lucky or unlucky guess
 *  shouldn't crown (or clear) a technique on its own. Falls back to the whole set once there just
 *  isn't 3-attempts-deep data anywhere yet, rather than showing nothing at all. */
function weakestTechnique(stats: TechniqueRecognitionStats[]): TechniqueId | null {
  const eligible = stats.filter((s) => s.attempts >= 3);
  const pool = eligible.length > 0 ? eligible : stats;
  if (pool.length === 0) return null;
  return pool.reduce((worst, s) => (s.accuracy < worst.accuracy ? s : worst)).technique;
}

export default function IntegralRecognition() {
  const run = useRecognitionRun();

  if (run.status === "ready") return <RecognitionLanding onStart={run.start} />;
  if (run.status === "done" && run.result) {
    return <RecognitionDone run={run} onAgain={run.start} onExit={run.reset} />;
  }
  return <RecognitionRunning run={run} />;
}

// ── ready ──────────────────────────────────────────────────────────────────────────────────────

function RecognitionLanding({ onStart }: { onStart: () => void }) {
  const attempts = useRecognitionAttempts();
  const allTime = useMemo(() => summarize(attempts), [attempts]);
  const weakest = useMemo(() => weakestTechnique(allTime.byTechnique), [allTime.byTechnique]);

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
            Name the weapon
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {RECOGNITION_ROUND_LENGTH} integrals, {Math.round(RECOGNITION_TIME_LIMIT_MS / 1000)} seconds
            each. Pick the technique — don't solve it. Recognising the right move on sight is most of
            the ninety seconds a real accessible question gives you.
          </p>
        </header>

        {allTime.total > 0 && (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">All-time</div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <div className="readout text-[26px] font-semibold tabular-nums text-foreground">
                  {Math.round(allTime.accuracy * 100)}%
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">accuracy · {allTime.total} picks</div>
              </div>
              <div>
                <div className="readout text-[26px] font-semibold tabular-nums text-foreground">
                  {msLabel(allTime.medianResponseMs)}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">median response</div>
              </div>
            </div>
            {weakest && (
              <p className="mt-4 text-[13px] text-muted-foreground">
                Weakest so far: <span className="font-medium text-foreground">{TECHNIQUE_BY_ID[weakest].name}</span>
              </p>
            )}
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

// ── running ────────────────────────────────────────────────────────────────────────────────────

function RecognitionRunning({ run }: { run: RecognitionRunApi }) {
  const question = run.question;
  if (!question) return null;

  const fraction = run.remainingMs / RECOGNITION_TIME_LIMIT_MS;
  const urgent = run.remainingMs <= 1000 && !run.answered;
  const correctTechnique = question.problem.techniques[0];

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="reveal mb-5 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            Question {run.index + 1} of {run.round.length}
          </span>
          <span
            role="timer"
            aria-live="off"
            className={`readout flex items-center gap-1.5 tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}
          >
            <Timer className="h-3.5 w-3.5" /> {(run.remainingMs / 1000).toFixed(1)}s
          </span>
        </div>
        <div className="reveal mb-6 h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${urgent ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.max(0, fraction * 100)}%` }}
          />
        </div>

        <div className="reveal mb-8 overflow-x-auto rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <Tex block className="text-foreground">
            {integralLatex(question.problem)}
          </Tex>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.choices.map((techniqueId) => {
            const isSelected = run.selected === techniqueId;
            const isCorrectChoice = techniqueId === correctTechnique;
            let tone = "border-border text-foreground hover:border-primary/40";
            if (run.answered) {
              if (isCorrectChoice) tone = "border-primary/60 bg-primary/[0.12] text-primary";
              else if (isSelected) tone = "border-destructive/60 bg-destructive/[0.08] text-destructive";
              else tone = "border-border text-muted-foreground/50";
            }
            return (
              <button
                key={techniqueId}
                onClick={() => run.select(techniqueId)}
                disabled={run.answered}
                aria-pressed={isSelected}
                className={`flex items-center justify-between gap-2 rounded-xl border p-4 text-left text-[14px] font-medium transition-colors ${tone}`}
              >
                {TECHNIQUE_BY_ID[techniqueId].name}
                {run.answered && isCorrectChoice && <Check className="h-4 w-4 shrink-0" />}
                {run.answered && isSelected && !isCorrectChoice && <X className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}

// ── done ───────────────────────────────────────────────────────────────────────────────────────

function RecognitionDone({
  run,
  onAgain,
  onExit,
}: {
  run: RecognitionRunApi;
  onAgain: () => void;
  onExit: () => void;
}) {
  const result = run.result;
  if (!result) return null;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Round done.
          </h1>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            <div>
              <div className="readout text-[40px] font-bold leading-none tabular-nums text-primary">
                {result.correct}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">of {result.total}</div>
            </div>
            <div>
              <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                {Math.round(result.accuracy * 100)}%
              </div>
              <div className="text-[12px] text-muted-foreground">accuracy</div>
            </div>
            <div>
              <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                {msLabel(result.medianResponseMs)}
              </div>
              <div className="text-[12px] text-muted-foreground">median response</div>
            </div>
          </div>
        </section>

        {result.byTechnique.length > 0 && (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="mb-3 font-display text-[16px] font-semibold text-foreground">By technique</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Technique
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Accuracy
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Median
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.byTechnique.map((t) => (
                    <tr key={t.technique} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 text-foreground">{TECHNIQUE_BY_ID[t.technique].name}</td>
                      <td className="readout py-2 pr-3 text-right tabular-nums text-muted-foreground">
                        {t.correct}/{t.attempts}
                      </td>
                      <td className="readout py-2 text-right tabular-nums text-muted-foreground">
                        {msLabel(t.medianResponseMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onAgain}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" /> Again
          </button>
          <button
            onClick={onExit}
            className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Done
          </button>
        </div>
      </main>
    </AppShell>
  );
}
