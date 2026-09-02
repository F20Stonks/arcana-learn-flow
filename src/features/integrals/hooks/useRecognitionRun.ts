import { useCallback, useEffect, useRef, useState } from "react";
import {
  assembleRound,
  RECOGNITION_ROUND_LENGTH,
  RECOGNITION_TIME_LIMIT_MS,
  summarize,
  type RecognitionAttempt,
  type RecognitionQuestion,
  type RecognitionSummary,
} from "../recognition";
import { recordRecognitionAttempt } from "../recognitionHistory";
import type { TechniqueId } from "../types";

export type RecognitionRunStatus = "ready" | "running" | "done";

/** How long the correct/wrong flash stays up before the next question appears — long enough to
 *  register, short enough that a 20-question round still takes well under a minute. */
const FEEDBACK_DELAY_MS = 650;

export interface RecognitionRunApi {
  status: RecognitionRunStatus;
  round: RecognitionQuestion[];
  index: number;
  question: RecognitionQuestion | null;
  /** Milliseconds left on the current question's clock; frozen once answered. */
  remainingMs: number;
  /** The technique just picked for the current question, or null before a pick/timeout. */
  selected: TechniqueId | null;
  /** True from the moment the current question is answered (or times out) until the next one
   *  appears — the window the correct/wrong flash is shown in. */
  answered: boolean;
  attempts: RecognitionAttempt[];
  result: RecognitionSummary | null;
  start: () => void;
  select: (technique: TechniqueId) => void;
  reset: () => void;
}

/**
 * One "name the weapon" round: RECOGNITION_ROUND_LENGTH questions, each with its own
 * RECOGNITION_TIME_LIMIT_MS clock. A pick (or a timeout) is recorded immediately — every question
 * counts as evidence, same "log everything, not just the good outcomes" spirit as WS-1's attempt
 * log — then the round auto-advances after a brief flash, no separate "Next" click needed; the
 * whole point is testing instant recognition, not letting the pace slacken between questions.
 */
export function useRecognitionRun(): RecognitionRunApi {
  const [status, setStatus] = useState<RecognitionRunStatus>("ready");
  const [round, setRound] = useState<RecognitionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(RECOGNITION_TIME_LIMIT_MS);
  const [selected, setSelected] = useState<TechniqueId | null>(null);
  const [answered, setAnswered] = useState(false);
  const [attempts, setAttempts] = useState<RecognitionAttempt[]>([]);
  const [result, setResult] = useState<RecognitionSummary | null>(null);

  const questionStartedAt = useRef(0);
  const questionEndsAt = useRef(0);
  const advanceTimer = useRef<number | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  // Unmounting mid-round shouldn't leave a stray timeout trying to setState afterwards.
  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  const beginQuestion = useCallback(() => {
    questionStartedAt.current = Date.now();
    questionEndsAt.current = Date.now() + RECOGNITION_TIME_LIMIT_MS;
    setRemainingMs(RECOGNITION_TIME_LIMIT_MS);
    setSelected(null);
    setAnswered(false);
  }, []);

  const start = useCallback(() => {
    clearAdvanceTimer();
    const fresh = assembleRound(Date.now());
    setRound(fresh);
    setIndex(0);
    setAttempts([]);
    setResult(null);
    setStatus("running");
    beginQuestion();
  }, [beginQuestion, clearAdvanceTimer]);

  const finish = useCallback((finalAttempts: RecognitionAttempt[]) => {
    setResult(summarize(finalAttempts));
    setStatus("done");
  }, []);

  // Records the answer (or timeout) and schedules the move to the next question — shared by both
  // a real pick and a clock-out, so both go through exactly one recording path. Deliberately
  // computes `next` up front and schedules the timeout as an ordinary side effect in the callback
  // body, not inside the setAttempts updater — an updater can run more than once (React may
  // re-invoke it, e.g. under StrictMode), which would double-schedule the advance.
  const answer = useCallback(
    (technique: TechniqueId | null) => {
      if (status !== "running" || answered) return;
      const question = round[index];
      if (!question) return;

      const correct = technique === question.problem.techniques[0];
      const responseMs = technique === null ? null : Date.now() - questionStartedAt.current;

      const recorded = recordRecognitionAttempt({
        technique: question.problem.techniques[0],
        correct,
        responseMs,
      });

      setSelected(technique);
      setAnswered(true);
      const next = [...attempts, recorded];
      setAttempts(next);

      clearAdvanceTimer();
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        if (index + 1 >= round.length) {
          finish(next);
        } else {
          setIndex((i) => i + 1);
          beginQuestion();
        }
      }, FEEDBACK_DELAY_MS);
    },
    [status, answered, round, index, attempts, beginQuestion, clearAdvanceTimer, finish],
  );

  const select = useCallback((technique: TechniqueId) => answer(technique), [answer]);

  // The per-question clock. 100ms ticks — smooth enough for a 3s countdown without the overhead
  // of a rAF loop; times out into the same `answer` path a real pick uses, with technique = null.
  useEffect(() => {
    if (status !== "running" || answered) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, questionEndsAt.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) answer(null);
    }, 100);
    return () => window.clearInterval(id);
  }, [status, answered, answer]);

  const reset = useCallback(() => {
    clearAdvanceTimer();
    setStatus("ready");
    setRound([]);
    setIndex(0);
    setAttempts([]);
    setResult(null);
  }, [clearAdvanceTimer]);

  return {
    status,
    round,
    index,
    question: round[index] ?? null,
    remainingMs,
    selected,
    answered,
    attempts,
    result,
    start,
    select,
    reset,
  };
}

export { RECOGNITION_ROUND_LENGTH };
