import { useCallback, useEffect, useRef, useState } from "react";
import type { DrillAttemptLog, DrillDefinition, DrillMode, DrillProblem } from "../types";
import { fetchWeakSpots, finishDrillRun } from "./persistence";

export type DrillStatus = "idle" | "running" | "finished";

export interface DrillRunResult {
  correctCount: number;
  incorrectCount: number;
  score: number;
  xpEarned: number;
  perMinute: number;
}

interface UseDrillRunArgs {
  def: DrillDefinition;
  userId: string | undefined;
  mode: DrillMode;
  durationS: number;
  config?: Record<string, unknown>;
}

const LEVEL_UP_STREAK = 3;

function defaultCheck(problem: DrillProblem, raw: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  return norm(raw) === norm(problem.answer);
}

export function useDrillRun({ def, userId, mode, durationS, config }: UseDrillRunArgs) {
  const [status, setStatus] = useState<DrillStatus>("idle");
  const [timeLeftMs, setTimeLeftMs] = useState(durationS * 1000);
  const [problem, setProblem] = useState<DrillProblem | null>(null);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(0);
  const [flash, setFlash] = useState<"correct" | "incorrect" | null>(null);
  const [result, setResult] = useState<DrillRunResult | null>(null);

  const attemptsRef = useRef<DrillAttemptLog[]>([]);
  const problemStartRef = useRef<number>(0);
  const biasTagsRef = useRef<string[]>([]);
  // setInterval, not requestAnimationFrame: rAF is frozen by the browser on a hidden/backgrounded
  // tab, which would silently stop the countdown for anyone who alt-tabs mid-drill.
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const deadlineRef = useRef<number>(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const nextProblem = useCallback(
    (atLevel: number) => {
      const p = def.generate({
        level: atLevel,
        rng: Math.random,
        biasTags: mode === "weak-spot" ? biasTagsRef.current : undefined,
        config,
      });
      setProblem(p);
      problemStartRef.current = performance.now();
    },
    [def, mode, config],
  );

  const tick = useCallback(() => {
    const remaining = deadlineRef.current - Date.now();
    if (remaining <= 0) {
      setTimeLeftMs(0);
      clearInterval(intervalRef.current);
      setStatus((s) => (s === "running" ? "finished" : s));
      return;
    }
    setTimeLeftMs(remaining);
  }, []);

  const start = useCallback(async () => {
    attemptsRef.current = [];
    setStreak(0);
    setResult(null);
    let startLevel = 0;
    if (mode === "weak-spot" && userId) {
      const spots = await fetchWeakSpots(userId, def.key);
      biasTagsRef.current = spots.map((s) => s.problem_tag);
    } else {
      biasTagsRef.current = [];
    }
    setLevel(startLevel);
    deadlineRef.current = Date.now() + durationS * 1000;
    setTimeLeftMs(durationS * 1000);
    setStatus("running");
    nextProblem(startLevel);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 100);
  }, [mode, userId, def.key, durationS, nextProblem, tick]);

  const submit = useCallback(
    (raw: string) => {
      if (status !== "running" || !problem) return;
      const latencyMs = performance.now() - problemStartRef.current;
      const correct = (def.check || defaultCheck)(problem, raw);
      attemptsRef.current.push({ tag: problem.tag, correct, latencyMs });

      setFlash(correct ? "correct" : "incorrect");
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 260);

      let nextLevel = level;
      if (mode === "adaptive") {
        if (correct) {
          const s = streak + 1;
          setStreak(s);
          if (s % LEVEL_UP_STREAK === 0) nextLevel = level + 1;
        } else {
          setStreak(0);
          nextLevel = Math.max(0, level - 1);
        }
        if (nextLevel !== level) setLevel(nextLevel);
      } else {
        setStreak(correct ? streak + 1 : 0);
      }

      if (Date.now() >= deadlineRef.current) {
        setStatus("finished");
        return;
      }
      nextProblem(nextLevel);
    },
    [status, problem, def, mode, level, streak, nextProblem],
  );

  useEffect(() => {
    if (status !== "finished") return;
    clearInterval(intervalRef.current);
    if (!userId) return;
    let cancelled = false;
    finishDrillRun({
      userId,
      drillKey: def.key,
      mode,
      config: config || {},
      attempts: attemptsRef.current,
      durationS,
    }).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProblem(null);
    setResult(null);
    setTimeLeftMs(durationS * 1000);
  }, [durationS]);

  return {
    status,
    timeLeftMs,
    problem,
    streak,
    level,
    flash,
    result,
    liveCorrect: attemptsRef.current.filter((a) => a.correct).length,
    liveTotal: attemptsRef.current.length,
    start,
    submit,
    reset,
  };
}
