import { useCallback, useEffect, useRef, useState } from "react";
import { PROBLEMS, primaryTechnique } from "../problems";
import {
  beatsTarget,
  headsolveBand,
  headsolveTargetMs,
  nextHeadsolveProblem,
  type HeadsolveGrade,
  type HeadsolveLadderState,
} from "../headsolve";
import { getHeadsolveAttempts, getLadderState, recordHeadsolveAttempt } from "../headsolveHistory";
import type { Problem } from "../types";

export type HeadsolveRunStatus = "ready" | "thinking" | "revealed";

/** How many recently-shown problem ids to steer clear of — a short rolling window, not the whole
 *  session's history, so a long session doesn't exhaust a level's ~66-problem pool by excluding
 *  everything it has ever shown. */
const RECENT_WINDOW = 8;

export interface HeadsolveRunApi {
  status: HeadsolveRunStatus;
  problem: Problem | null;
  /** Ticks every 100ms while thinking; frozen at the think time the instant the clock is stopped. */
  elapsedMs: number;
  /** Set only once the clock has actually been stopped — the number this attempt gets graded on. */
  thinkMs: number | null;
  /** The current problem's band target, ms; null for the tail band, which has none. */
  targetMs: number | null;
  /** Whether thinkMs beat targetMs. Null before the clock is stopped, or when there's no target. */
  beat: boolean | null;
  ladder: HeadsolveLadderState;
  /** How many problems have been graded this session (since the last start()). */
  sessionCount: number;
  sessionGotIt: number;
  start: () => void;
  stopClock: () => void;
  gradeSelf: (grade: HeadsolveGrade) => void;
  finish: () => void;
}

/**
 * One headsolve session: a run of problems shown one at a time with no answer input. Each cycles
 * "thinking" (clock running) -> stopClock -> "revealed" (clock frozen, answer shown, grade it) ->
 * gradeSelf -> back to "thinking" on the next problem, chosen by the ladder's current level.
 *
 * Deliberately open-ended, unlike the recognition drill's fixed 20-question round — headsolving is
 * a streak/ladder drill you keep going on for as long as you want, not a scored round with a fixed
 * length; `finish()` just returns to the ready screen, which then shows updated all-time stats via
 * useHeadsolveHistory.
 */
export function useHeadsolveRun(): HeadsolveRunApi {
  const [status, setStatus] = useState<HeadsolveRunStatus>("ready");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [thinkMs, setThinkMs] = useState<number | null>(null);
  const [ladder, setLadder] = useState<HeadsolveLadderState>(() => getLadderState());
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionGotIt, setSessionGotIt] = useState(0);

  const startedAt = useRef(0);
  const recentIds = useRef<string[]>([]);

  const showNext = useCallback((level: number) => {
    const next = nextHeadsolveProblem(
      PROBLEMS,
      level,
      getHeadsolveAttempts(),
      new Set(recentIds.current),
      Date.now(),
    );
    if (!next) return; // PROBLEMS is never empty in practice — defensive, not expected to trigger
    recentIds.current = [...recentIds.current, next.id].slice(-RECENT_WINDOW);
    setProblem(next);
    setThinkMs(null);
    startedAt.current = Date.now();
    setElapsedMs(0);
    setStatus("thinking");
  }, []);

  const start = useCallback(() => {
    const current = getLadderState();
    setLadder(current);
    setSessionCount(0);
    setSessionGotIt(0);
    recentIds.current = [];
    showNext(current.level);
  }, [showNext]);

  // The clock — ticks only while actively thinking, frozen the instant it's stopped.
  useEffect(() => {
    if (status !== "thinking") return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 100);
    return () => window.clearInterval(id);
  }, [status]);

  const stopClock = useCallback(() => {
    if (status !== "thinking") return;
    const ms = Date.now() - startedAt.current;
    setThinkMs(ms);
    setElapsedMs(ms);
    setStatus("revealed");
  }, [status]);

  // Recording happens as a plain call here, never inside a setState updater — an updater can run
  // more than once (React may re-invoke it), which would double-record the attempt. Same lesson
  // useRecognitionRun's `answer` callback already applies to its own recording call.
  const gradeSelf = useCallback(
    (grade: HeadsolveGrade) => {
      if (status !== "revealed" || !problem || thinkMs === null) return;
      const { ladder: nextLadder } = recordHeadsolveAttempt({
        problemId: problem.id,
        technique: primaryTechnique(problem),
        band: headsolveBand(problem),
        grade,
        thinkMs,
      });
      setLadder(nextLadder);
      setSessionCount((n) => n + 1);
      if (grade === "got-it") setSessionGotIt((n) => n + 1);
      showNext(nextLadder.level);
    },
    [status, problem, thinkMs, showNext],
  );

  const finish = useCallback(() => {
    setStatus("ready");
    setProblem(null);
  }, []);

  return {
    status,
    problem,
    elapsedMs,
    thinkMs,
    targetMs: problem ? headsolveTargetMs(problem) : null,
    beat: thinkMs !== null && problem ? beatsTarget(headsolveBand(problem), thinkMs) : null,
    ladder,
    sessionCount,
    sessionGotIt,
    start,
    stopClock,
    gradeSelf,
    finish,
  };
}
