/**
 * The daily integral. One problem, one attempt, everyone on the same one — that's what makes the
 * score worth comparing, so a finished day shows the result and the solution rather than a replay.
 * Anything you want to try again lives in training.
 */
import { Link } from "react-router-dom";
import { ArrowLeft, Dumbbell } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import RunPanel from "@/features/integrals/components/RunPanel";
import DailyResult from "@/features/integrals/components/DailyResult";
import SolutionSteps from "@/features/integrals/components/SolutionSteps";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import { useIntegralRun } from "@/features/integrals/hooks/useIntegralRun";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import LeaderboardPanel from "@/features/integrals/components/LeaderboardPanel";
import { useDailyBoard } from "@/features/integrals/hooks/useDailyBoard";
import { dailyNumber, dailyProblem, WEEKDAY_NAMES } from "@/features/integrals/daily";
import { liveStreak, todaysDaily } from "@/features/integrals/progress";
import { PROBLEM_BY_ID } from "@/features/integrals/problems";

export default function DailyIntegral() {
  const progress = useProgress();
  const { user } = useAuth();
  const problem = dailyProblem();
  const puzzleNumber = dailyNumber();
  const run = useIntegralRun(problem, "daily");
  const record = todaysDaily(progress);
  const streak = liveStreak(progress);
  const board = useDailyBoard(puzzleNumber, record, user?.id ?? null);

  // A day already finished before this page mounted — rebuild it from storage rather than
  // handing out a second attempt at a scored problem.
  const finishedEarlier = record !== undefined && run.status === "running";
  const recorded = record ? PROBLEM_BY_ID[record.problemId] ?? problem : problem;

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
            {streak > 0 && ` · ${streak} day streak on the line`}
          </p>
        </header>

        {finishedEarlier ? (
          <div className="flex flex-col gap-5">
            <IntegralPrompt problem={recorded} />
            <DailyResult
              problem={recorded}
              solved={record.solved}
              seconds={record.seconds}
              hintsUsed={record.hintsUsed}
              wrongAttempts={record.wrongAttempts}
              streak={streak}
              score={null}
              totalScore={record.score}
            />
            <SolutionSteps problem={recorded} />
            <LeaderboardPanel board={board} puzzleNumber={puzzleNumber} />
          </div>
        ) : (
          <RunPanel
            problem={problem}
            run={run}
            confirmGiveUp
            footer={
              <DailyResult
                problem={problem}
                solved={run.status === "solved"}
                seconds={run.elapsed}
                hintsUsed={run.hintsUsed}
                wrongAttempts={run.wrongAttempts}
                streak={streak}
                score={run.score}
              />
            }
          />
        )}

        {run.status !== "running" && (
          <div className="mt-5">
            <LeaderboardPanel board={board} puzzleNumber={puzzleNumber} />
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
