import { useCallback, useEffect, useRef, useState } from "react";
import { gradeAnswer } from "../answer";
import { getProgress, hasSolved, liveStreak, recordDaily, type DailySlotOutcome } from "../progress";
import { scoreAttempt, type ScoreBreakdown } from "../scoring";
import type { Problem, Verdict } from "../types";

export type SlotStatus = "running" | "solved" | "revealed";

export interface SlotState {
  status: SlotStatus;
  input: string;
  verdict: Verdict | null;
  hintsUsed: number;
  wrongAttempts: number;
  /** Seconds, ticking while this slot is live and frozen the moment it ends. */
  elapsed: number;
  score: ScoreBreakdown | null;
}

export interface DailyRunApi extends SlotState {
  /** 0-based index of the problem currently on screen. */
  slotIndex: number;
  problem: Problem;
  setInput: (v: string) => void;
  submit: () => void;
  revealHint: () => void;
  giveUp: () => void;
  /** No second attempts on a daily — kept only so this satisfies the same shape RunPanel expects. */
  restart: () => void;
  /** Moves on to the next slot; a no-op on the last one until the session is fully recorded. */
  advance: () => void;
  hintsLeft: number;
  /** Every slot has an outcome and the session was written to progress. */
  finished: boolean;
  outcomes: DailySlotOutcome[];
}

/**
 * A full daily session: `problems.length` integrals back to back, scored individually but
 * recorded to progress as one combined day — see `recordDaily` in progress.ts for why. A page
 * refresh mid-session loses the slots already finished (nothing is persisted until the last one
 * lands); that's an accepted simplification, not an oversight — the alternative is a second,
 * partial-session storage schema for a case that a same-day retry already recovers from cleanly.
 */
export function useDailyRun(problems: Problem[]): DailyRunApi {
  const [slotIndex, setSlotIndex] = useState(0);
  const [slot, setSlot] = useState<SlotState>(() => initial());
  const [outcomes, setOutcomes] = useState<DailySlotOutcome[]>([]);
  const startedAt = useRef(Date.now());
  const recordedSession = useRef(false);
  const problem = problems[Math.min(slotIndex, problems.length - 1)];

  useEffect(() => {
    setSlot(initial());
    startedAt.current = Date.now();
  }, [slotIndex, problem.id]);

  useEffect(() => {
    if (slot.status !== "running") return;
    const id = window.setInterval(() => {
      setSlot((s) => (s.status === "running" ? { ...s, elapsed: seconds(startedAt.current) } : s));
    }, 250);
    return () => window.clearInterval(id);
  }, [slot.status]);

  const setInput = useCallback((input: string) => {
    setSlot((s) => (s.status === "running" ? { ...s, input, verdict: null } : s));
  }, []);

  const finishSlot = useCallback(
    (outcome: DailySlotOutcome) => {
      setOutcomes((prev) => {
        const next = [...prev, outcome];
        if (next.length === problems.length && !recordedSession.current) {
          recordedSession.current = true;
          recordDaily(next);
        }
        return next;
      });
    },
    [problems.length],
  );

  const submit = useCallback(() => {
    setSlot((s) => {
      if (s.status !== "running" || !s.input.trim()) return s;
      const verdict = gradeAnswer(problem, s.input);
      if (verdict.status !== "correct") {
        // A misread expression isn't a wrong answer — don't charge for it.
        const charged = verdict.status === "unparseable" ? s.wrongAttempts : s.wrongAttempts + 1;
        return { ...s, verdict, wrongAttempts: charged };
      }

      const elapsed = seconds(startedAt.current);
      const progressNow = getProgress();
      const score = scoreAttempt({
        difficulty: problem.difficulty,
        seconds: elapsed,
        hintsUsed: s.hintsUsed,
        wrongAttempts: s.wrongAttempts,
        streak: liveStreak(progressNow),
        mode: "daily",
        repeat: hasSolved(progressNow, problem.id),
      });
      finishSlot({
        problemId: problem.id,
        solved: true,
        seconds: elapsed,
        hintsUsed: s.hintsUsed,
        wrongAttempts: s.wrongAttempts,
        score: score.total,
      });
      return { ...s, status: "solved", verdict, elapsed, score };
    });
  }, [problem, finishSlot]);

  const revealHint = useCallback(() => {
    setSlot((s) =>
      s.status === "running" && s.hintsUsed < problem.hints.length
        ? { ...s, hintsUsed: s.hintsUsed + 1 }
        : s,
    );
  }, [problem.hints.length]);

  const giveUp = useCallback(() => {
    setSlot((s) => {
      if (s.status !== "running") return s;
      const elapsed = seconds(startedAt.current);
      finishSlot({
        problemId: problem.id,
        solved: false,
        seconds: elapsed,
        hintsUsed: s.hintsUsed,
        wrongAttempts: s.wrongAttempts,
        score: 0,
      });
      return { ...s, status: "revealed", elapsed };
    });
  }, [problem, finishSlot]);

  const advance = useCallback(() => {
    setSlotIndex((i) => Math.min(i + 1, problems.length - 1));
  }, [problems.length]);

  const restart = useCallback(() => {}, []);

  return {
    ...slot,
    slotIndex,
    problem,
    setInput,
    submit,
    revealHint,
    giveUp,
    restart,
    advance,
    hintsLeft: problem.hints.length - slot.hintsUsed,
    finished: outcomes.length === problems.length,
    outcomes,
  };
}

function initial(): SlotState {
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
