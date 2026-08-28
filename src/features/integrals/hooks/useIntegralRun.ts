import { useCallback, useEffect, useRef, useState } from "react";
import { gradeAnswer } from "../answer";
import { recordTrainingSolve, getProgress, hasSolved, liveStreak } from "../progress";
import { scoreAttempt, type ScoreBreakdown } from "../scoring";
import type { Problem, Verdict } from "../types";

export type RunStatus = "running" | "solved" | "revealed";

export interface RunState {
  status: RunStatus;
  input: string;
  verdict: Verdict | null;
  hintsUsed: number;
  wrongAttempts: number;
  /** Seconds, ticking while the run is live and frozen the moment it ends. */
  elapsed: number;
  score: ScoreBreakdown | null;
}

export interface RunApi extends RunState {
  setInput: (v: string) => void;
  submit: () => void;
  revealHint: () => void;
  giveUp: () => void;
  restart: () => void;
  hintsLeft: number;
}

/**
 * One training attempt at one integral. Owns the clock, the hint ladder and the grading, and
 * writes the result to the progress store exactly once — on solving. The daily has its own
 * session-scoped hook (`useDailyRun`) since a day is `DAILY_SLOTS` problems recorded together,
 * not one at a time.
 */
export function useIntegralRun(problem: Problem): RunApi {
  const [state, setState] = useState<RunState>(() => initial());
  const startedAt = useRef(Date.now());
  const recorded = useRef(false);

  // A fresh problem is a fresh run.
  useEffect(() => {
    setState(initial());
    startedAt.current = Date.now();
    recorded.current = false;
  }, [problem.id]);

  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => {
      setState((s) => (s.status === "running" ? { ...s, elapsed: seconds(startedAt.current) } : s));
    }, 250);
    return () => window.clearInterval(id);
  }, [state.status, problem.id]);

  const setInput = useCallback((input: string) => {
    setState((s) => (s.status === "running" ? { ...s, input, verdict: null } : s));
  }, []);

  const submit = useCallback(() => {
    setState((s) => {
      if (s.status !== "running" || !s.input.trim()) return s;
      const verdict = gradeAnswer(problem, s.input);
      if (verdict.status !== "correct") {
        // A misread expression isn't a wrong answer — don't charge for it.
        const charged = verdict.status === "unparseable" ? s.wrongAttempts : s.wrongAttempts + 1;
        return { ...s, verdict, wrongAttempts: charged };
      }

      const elapsed = seconds(startedAt.current);
      const progress = getProgress();
      const score = scoreAttempt({
        difficulty: problem.difficulty,
        seconds: elapsed,
        hintsUsed: s.hintsUsed,
        wrongAttempts: s.wrongAttempts,
        streak: liveStreak(progress),
        mode: "training",
        repeat: hasSolved(progress, problem.id),
      });

      if (!recorded.current) {
        recorded.current = true;
        recordTrainingSolve({
          problemId: problem.id,
          seconds: elapsed,
          hintsUsed: s.hintsUsed,
          wrongAttempts: s.wrongAttempts,
          xp: score.total,
          score: score.total,
        });
      }

      return { ...s, status: "solved", verdict, elapsed, score };
    });
  }, [problem]);

  const revealHint = useCallback(() => {
    setState((s) =>
      s.status === "running" && s.hintsUsed < problem.hints.length
        ? { ...s, hintsUsed: s.hintsUsed + 1 }
        : s,
    );
  }, [problem.hints.length]);

  const giveUp = useCallback(() => {
    setState((s) => {
      if (s.status !== "running") return s;
      const elapsed = seconds(startedAt.current);
      return { ...s, status: "revealed", elapsed };
    });
  }, []);

  const restart = useCallback(() => {
    setState(initial());
    startedAt.current = Date.now();
    recorded.current = false;
  }, []);

  return {
    ...state,
    setInput,
    submit,
    revealHint,
    giveUp,
    restart,
    hintsLeft: problem.hints.length - state.hintsUsed,
  };
}

function initial(): RunState {
  return {
    status: "running",
    input: "",
    verdict: null,
    hintsUsed: 0,
    wrongAttempts: 0,
    elapsed: 0,
    score: null,
  };
}

function seconds(from: number): number {
  return Math.max(0, Math.round((Date.now() - from) / 1000));
}
