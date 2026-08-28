/**
 * The daily integral. Three problems, one attempt each, everyone on the same three — that's what
 * makes the combined score worth comparing, so a finished day shows the result and every solution
 * rather than a replay. Anything you want to try again lives in training.
 */
import { useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import RunPanel from "@/features/integrals/components/RunPanel";
import DailyResult from "@/features/integrals/components/DailyResult";
import SolutionSteps from "@/features/integrals/components/SolutionSteps";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import { useDailyRun } from "@/features/integrals/hooks/useDailyRun";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import LeaderboardPanel from "@/features/integrals/components/LeaderboardPanel";
import { useDailyBoard } from "@/features/integrals/hooks/useDailyBoard";
import { dailyNumber, dailyProblems, WEEKDAY_NAMES } from "@/features/integrals/daily";
import { liveStreak, todaysDaily } from "@/features/integrals/progress";
import { PROBLEM_BY_ID } from "@/features/integrals/problems";

export default function DailyIntegral() {
  const progress = useProgress();
  const { user } = useAuth();
  const problems = dailyProblems();
  const puzzleNumber = dailyNumber();
  const run = useDailyRun(problems);
  const record = todaysDaily(progress);
  const streak = liveStreak(progress);
  const board = useDailyBoard(puzzleNumber, record, user?.id ?? null);

  // A day already finished before this page mounted — rebuild it from storage rather than handing
  // out a second attempt at a scored day.
  const finishedEarlier = record !== undefined && !run.finished;
  const solvedProblems = record
    ? record.problemIds.map((id) => PROBLEM_BY_ID[id]).filter((p): p is NonNullable<typeof p> => Boolean(p))
    : problems;
  const showingSummary = finishedEarlier || run.finished;

  // Same reasoning as RunPanel's own focus management: when a slot's input disappears, keyboard
  // and screen-reader focus falls back to the document unless something claims it.
  const over = showingSummary || run.status !== "running";
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (over) result.current?.focus();
  }, [over, run.slotIndex, showingSummary]);

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
            Daily #{puzzleNumber}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {WEEKDAY_NAMES[new Date().getDay()]}
            {!showingSummary && ` · Integral ${run.slotIndex + 1} of ${problems.length}`}
            {streak > 0 && ` · ${streak} day streak on the line`}
          </p>
        </header>

        {showingSummary ? (
          <div ref={result} tabIndex={-1} className="flex flex-col gap-5 outline-hidden">
            <DailyResult
              problem={solvedProblems[0] ?? problems[0]}
              solved={record?.solved ?? run.outcomes.every((o) => o.solved)}
              seconds={record?.seconds ?? run.outcomes.reduce((sum, o) => sum + o.seconds, 0)}
              hintsUsed={record?.hintsUsed ?? run.outcomes.reduce((sum, o) => sum + o.hintsUsed, 0)}
              wrongAttempts={record?.wrongAttempts ?? run.outcomes.reduce((sum, o) => sum + o.wrongAttempts, 0)}
              streak={streak}
              score={null}
              totalScore={record?.score ?? run.outcomes.reduce((sum, o) => sum + o.score, 0)}
            />
            {solvedProblems.map((p) => (
              <div key={p.id} className="flex flex-col gap-3">
                <IntegralPrompt problem={p} />
                <SolutionSteps problem={p} />
              </div>
            ))}
            <LeaderboardPanel board={board} puzzleNumber={puzzleNumber} />
          </div>
        ) : run.status === "running" ? (
          <RunPanel problem={run.problem} run={run} />
        ) : (
          <div className="flex flex-col gap-5">
            <IntegralPrompt problem={run.problem} />
            <div
              ref={result}
              tabIndex={-1}
              className="reveal rounded-2xl border border-border bg-card p-5 text-center outline-hidden sm:p-6"
            >
              <p className="text-[15px] font-medium text-foreground">
                {run.status === "solved" ? "Correct." : "Solution revealed."}
              </p>
              <button
                onClick={run.advance}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Next integral ({run.slotIndex + 2} of {problems.length}) <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <SolutionSteps problem={run.problem} />
          </div>
        )}

        <Link
          to="/integrals/train"
          className="reveal mt-8 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Dumbbell className="h-3.5 w-3.5" /> Practise this kind of integral in training
        </Link>
      </main>
    </AppShell>
  );
}
