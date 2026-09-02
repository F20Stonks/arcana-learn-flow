/**
 * UK Round 1 — the weekly full paper. 30 problems, 120 minutes, one seed per calendar week so
 * "this week's paper" means the same thing all week and the next is a fresh one.
 *
 * Deliberately not the daily/training/sprint's lockstep flow: a real solo sitting means free
 * navigation (jump to any question, flag one and come back), a single clock for the whole paper,
 * and — once it ends — a pacing report broken down by band rather than just a score. All grading
 * and assembly is reused from elsewhere in the feature (usePaperRun wires gradeAnswer and
 * assemblePaper); this file is presentation only.
 *
 * Three screens, driven by local phase state so the 120-minute clock in usePaperRun never starts
 * just from landing on the route:
 *  - landing: the rules, and last week's — or an earlier sitting's — result if there is one.
 *  - running: the free-navigation answer sheet (mounts usePaperRun, which is where the clock starts).
 *  - done: the review screen and per-band pacing report, read from the same run's live state.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Pause,
  Play,
  Send,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import AnswerInput from "@/features/integrals/components/AnswerInput";
import VerdictLine from "@/features/integrals/components/VerdictLine";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import SolutionSteps from "@/features/integrals/components/SolutionSteps";
import { integralLatex } from "@/features/integrals/latex";
import { formatDuration } from "@/features/integrals/scoring";
import { usePaperRun, type PaperRunApi } from "@/features/integrals/hooks/usePaperRun";
import {
  bandById,
  bandForIndex,
  PAPER_BANDS,
  PAPER_MINUTES,
  PAPER_QUESTION_COUNT,
  weekLabel,
  weekSeed,
} from "@/features/integrals/uk/paper";
import {
  getPaperSnapshot,
  paperResultForSeed,
  type PaperBandResult,
  type PaperResult,
  type PaperSlotSnapshot,
  type PaperSlotStatus,
} from "@/features/integrals/uk/paperHistory";
import type { Problem } from "@/features/integrals/types";

type Phase = "landing" | "live";

export default function IntegralPaper() {
  const seed = useMemo(() => weekSeed(), []);
  // A live snapshot for this exact week means a sitting is already under way (e.g. a reload
  // mid-paper) — resume straight into it rather than showing the rules again. Otherwise, land on
  // the instructions screen so opening this route by accident (or from a link) never silently
  // starts a 120-minute clock the way the daily's "starts when you open it" does for a much
  // shorter commitment.
  const [phase, setPhase] = useState<Phase>(() => {
    const snap = getPaperSnapshot();
    return snap && snap.seed === seed ? "live" : "landing";
  });

  if (phase === "landing") {
    return <PaperLanding seed={seed} onBegin={() => setPhase("live")} />;
  }
  return <PaperLive seed={seed} onExit={() => setPhase("landing")} />;
}

// ── landing ────────────────────────────────────────────────────────────────────────────────────

function PaperLanding({ seed, onBegin }: { seed: number; onBegin: () => void }) {
  const lastResult = paperResultForSeed(seed);

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
            UK Round 1 — this week's paper
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Week of {weekLabel(seed)}. {PAPER_QUESTION_COUNT} problems in {PAPER_MINUTES} minutes — the
            real solo qualifier format, not the one-at-a-time flow the rest of this app uses.
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[16px] font-semibold text-foreground">How it's run</h2>
          <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
            <li>
              Three bands of ten, easiest to hardest — but it's one answer sheet, not thirty separate
              screens: jump to any question at any time.
            </li>
            <li>
              One {PAPER_MINUTES}-minute clock for the whole paper. Pause if you need to step away — it
              stops the clock, not the sitting.
            </li>
            <li>Flag a question to come back to it later. Flags are for you; they don't affect marking.</li>
            <li>
              Hand in early, or let the clock end it for you. Either way you get a full pacing report —
              marks and minutes per band, and how much time went to questions that never landed.
            </li>
          </ul>
        </section>

        {lastResult && (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-primary" /> Already sat this week
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="readout text-[32px] font-bold leading-none tabular-nums text-primary">
                  {lastResult.score}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">of {lastResult.total}</div>
              </div>
              {lastResult.bands.map((b) => (
                <div key={b.bandId}>
                  <div className="readout text-[18px] font-semibold tabular-nums text-foreground">
                    {b.correct}/{b.total}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{bandById(b.bandId).name}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">
              {lastResult.endReason === "time-up" ? "Time ran out." : "Handed in."} Sitting again assembles
              the same 30 questions — that's deliberate, so a retry benchmarks against itself.
            </p>
          </section>
        )}

        <button
          onClick={onBegin}
          className="reveal flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Play className="h-4 w-4" /> {lastResult ? "Sit it again" : "Begin the paper"}
        </button>
      </main>
    </AppShell>
  );
}

// ── live: mounts the run hook (this is where the clock starts) ───────────────────────────────────

function PaperLive({ seed, onExit }: { seed: number; onExit: () => void }) {
  const run = usePaperRun(seed);
  if (run.status === "done" && run.result) {
    return <PaperDone run={run} result={run.result} onLanding={onExit} />;
  }
  return <PaperRunning run={run} />;
}

function PaperRunning({ run }: { run: PaperRunApi }) {
  const band = bandForIndex(run.currentIndex);
  const urgent = run.remainingSeconds <= 5 * 60;

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="reveal mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/integrals"
            className="inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
          </Link>
          <div className="flex items-center gap-3">
            <span
              role="timer"
              aria-live="off"
              className={`readout flex items-center gap-1.5 text-[18px] font-semibold tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}
            >
              <Timer className="h-4 w-4" />
              {formatDuration(run.remainingSeconds)}
            </span>
            <button
              onClick={run.togglePause}
              aria-pressed={run.paused}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {run.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {run.paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>

        <div className="reveal mb-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span>
            {run.attemptedCount} attempted · {run.correctCount} correct · {run.flaggedCount} flagged
          </span>
          <button
            onClick={run.submitPaper}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Send className="h-3.5 w-3.5" /> Hand in
          </button>
        </div>

        <QuestionNav paper={run.paper} slots={run.slots} current={run.currentIndex} onSelect={run.goTo} />

        {run.paused ? (
          <div className="reveal mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Pause className="h-6 w-6 text-muted-foreground" />
            <p className="text-[15px] text-muted-foreground">Paused — the clock is stopped.</p>
            <button
              onClick={run.togglePause}
              className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                {band.name} · Question {run.currentIndex + 1} of {PAPER_QUESTION_COUNT}
              </span>
              <button
                onClick={run.toggleFlag}
                aria-pressed={run.currentSlot.flagged}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${
                  run.currentSlot.flagged
                    ? "border-amber-500/60 bg-amber-500/[0.12] text-amber-600"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Flag className="h-3.5 w-3.5" /> {run.currentSlot.flagged ? "Flagged" : "Flag"}
              </button>
            </div>

            <IntegralPrompt problem={run.currentProblem} />

            <AnswerInput
              value={run.currentSlot.input}
              onChange={run.setInput}
              onSubmit={run.submit}
              verdict={run.verdict}
              placeholder={
                run.currentProblem.kind === "definite" ? "a number, e.g. pi/4" : "your answer, e.g. x^3/3 + C"
              }
            />
            <VerdictLine verdict={run.verdict} />

            <div className="flex items-center justify-between">
              <button
                onClick={run.prev}
                disabled={run.currentIndex === 0}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                onClick={run.next}
                disabled={run.currentIndex === PAPER_QUESTION_COUNT - 1}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

// ── done: review + pacing report ──────────────────────────────────────────────────────────────

function PaperDone({
  run,
  result,
  onLanding,
}: {
  run: PaperRunApi;
  result: PaperResult;
  onLanding: () => void;
}) {
  const [reviewIndex, setReviewIndex] = useState(0);
  const sinks = useMemo(() => biggestTimeSinks(run.paper, run.slots), [run.paper, run.slots]);
  const reviewProblem = run.paper[reviewIndex];
  const reviewSlot = run.slots[reviewIndex];
  const reviewBand = bandForIndex(reviewIndex);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {result.endReason === "time-up" ? "Time's up." : "Handed in."}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Week of {weekLabel(result.seed)} · {formatDuration(result.secondsUsed)} used of {PAPER_MINUTES}{" "}
            min
          </p>
        </header>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
            <div>
              <div className="readout text-[40px] font-bold leading-none tabular-nums text-primary">
                {result.score}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">of {result.total}</div>
            </div>
            <div>
              <div className="readout text-[22px] font-semibold tabular-nums text-foreground">
                {formatDuration(result.triageSeconds)}
              </div>
              <div className="text-[12px] text-muted-foreground">triage cost</div>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Triage cost is time spent on questions that never ended up correct — the clearest signal of
            where to cut losses faster next sitting.
          </p>
        </section>

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[16px] font-semibold text-foreground">Pacing by band</h2>
          <BandPacingTable bands={result.bands} />
        </section>

        {sinks.length > 0 && (
          <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="mb-1 font-display text-[16px] font-semibold text-foreground">
              Biggest time sinks
            </h2>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Time paid on questions that didn't land, worst first.
            </p>
            <ul className="flex flex-col gap-2.5">
              {sinks.map(({ problem, index, slot }) => (
                <li key={problem.id}>
                  <button
                    onClick={() => setReviewIndex(index)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="readout shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        Q{index + 1}
                      </span>
                      <span className="min-w-0 overflow-x-auto text-[13px] text-foreground">
                        <Tex>{integralLatex(problem)}</Tex>
                      </span>
                    </span>
                    <span className="readout shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {formatDuration(slot.secondsSpent)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="reveal mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[16px] font-semibold text-foreground">Review by question</h2>
          <QuestionNav paper={run.paper} slots={run.slots} current={reviewIndex} onSelect={setReviewIndex} />

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                {reviewBand.name} · Question {reviewIndex + 1}
              </span>
              <ReviewStatusBadge status={reviewSlot.status} />
            </div>
            <IntegralPrompt problem={reviewProblem} />
            {reviewSlot.input && (
              <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
                <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  Your last answer
                </div>
                <div className="readout mt-1 text-[14px] text-foreground">{reviewSlot.input}</div>
              </div>
            )}
            <SolutionSteps problem={reviewProblem} />
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/integrals"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back to Integral Arena
          </Link>
          <button
            onClick={onLanding}
            className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Round 1 overview
          </button>
        </div>
      </main>
    </AppShell>
  );
}

// ── shared bits ────────────────────────────────────────────────────────────────────────────────

function QuestionNav({
  paper,
  slots,
  current,
  onSelect,
}: {
  paper: Problem[];
  slots: PaperSlotSnapshot[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="reveal flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5">
      {PAPER_BANDS.map((band) => (
        <div key={band.id} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-[88px] shrink-0 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {band.name}
          </span>
          {Array.from({ length: band.end - band.start }, (_, k) => band.start + k).map((i) => {
            const slot = slots[i];
            const isCurrent = i === current;
            return (
              <button
                key={paper[i]?.id ?? i}
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Question ${i + 1}${slot.flagged ? ", flagged" : ""} — ${slot.status}`}
                className={`readout relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] tabular-nums transition-colors ${slotTone(slot.status)} ${
                  isCurrent ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                }`}
              >
                {i + 1}
                {slot.flagged && (
                  <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function slotTone(status: PaperSlotStatus): string {
  if (status === "correct") return "border-primary/60 bg-primary/[0.12] text-primary";
  if (status === "attempted") return "border-amber-500/50 bg-amber-500/[0.12] text-amber-600";
  return "border-border text-muted-foreground hover:border-primary/30";
}

function ReviewStatusBadge({ status }: { status: PaperSlotStatus }) {
  if (status === "correct") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary">
        <Check className="h-3.5 w-3.5" /> Correct
      </span>
    );
  }
  if (status === "attempted") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-destructive">
        <X className="h-3.5 w-3.5" /> Not landed
      </span>
    );
  }
  return <span className="text-[13px] text-muted-foreground">Not attempted</span>;
}

function BandPacingTable({ bands }: { bands: PaperBandResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Band</th>
            <th className="py-2 pr-4 font-medium">Marks</th>
            <th className="py-2 font-medium">Time spent</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.bandId} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-4">
                <div className="font-medium text-foreground">{bandById(b.bandId).name}</div>
                <div className="text-[12px] text-muted-foreground">{bandById(b.bandId).label}</div>
              </td>
              <td className="readout py-2.5 pr-4 tabular-nums text-foreground">
                {b.correct}/{b.total}
              </td>
              <td className="readout py-2.5 tabular-nums text-muted-foreground">
                {formatDuration(b.secondsSpent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Questions that never landed, worst time-paid first — the triage cost, broken out by question
 *  instead of just summed, so it's obvious which ones to bail on faster next time. */
function biggestTimeSinks(paper: Problem[], slots: PaperSlotSnapshot[], limit = 5) {
  return slots
    .map((slot, index) => ({ slot, problem: paper[index], index }))
    .filter((row) => row.slot.status !== "correct" && row.slot.secondsSpent > 0)
    .sort((a, b) => b.slot.secondsSpent - a.slot.secondsSpent)
    .slice(0, limit);
}
