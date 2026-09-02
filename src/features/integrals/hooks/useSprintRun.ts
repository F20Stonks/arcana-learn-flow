import { useCallback, useEffect, useRef, useState } from "react";
import { gradeAnswer } from "../answer";
import { getProgress, hasSolved, recordSprint, recordTrainingSolve } from "../progress";
import { buildQueue, solvePoints, sprintScore, type SprintConfig, type SprintResult } from "../sprint";
import { scoreAttempt } from "../scoring";
import type { Problem, Verdict } from "../types";

export type SprintStatus = "ready" | "running" | "done";

export interface SprintApi {
  status: SprintStatus;
  problem: Problem | null;
  input: string;
  verdict: Verdict | null;
  remaining: number;
  solved: Problem[];
  skipped: number;
  wrongAttempts: number;
  liveScore: number;
  result: SprintResult | null;
  /**
   * The problem just landed, and what it paid. Stays on screen until the next solve or skip:
   * the queue advances the instant an answer is right, so without this the only sign that a
   * correct answer *was* correct is the problem quietly changing.
   */
  landed: Landed | null;
  setInput: (v: string) => void;
  submit: () => void;
  skip: () => void;
  start: () => void;
  /** Ends the run now, keeping everything banked so far. */
  end: () => void;
  reset: () => void;
}

export interface Landed {
  problem: Problem;
  points: number;
  /** Bumped per solve so a repeat of the same problem still restarts the flash animation. */
  nonce: number;
}

/**
 * One sprint. Owns the clock, the queue and the grading.
 *
 * Solves are banked one at a time rather than in a batch at the end: a run abandoned halfway
 * should still leave the XP and mastery it earned.
 */
export function useSprintRun(config: SprintConfig): SprintApi {
  const [status, setStatus] = useState<SprintStatus>("ready");
  const [queue, setQueue] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [solved, setSolved] = useState<Problem[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [remaining, setRemaining] = useState<number>(config.seconds);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [missed, setMissed] = useState<Problem[]>([]);
  const [result, setResult] = useState<SprintResult | null>(null);

  const endsAt = useRef(0);
  const problemStartedAt = useRef(0);
  const recorded = useRef(false);

  const reset = useCallback(() => {
    setStatus("ready");
    setQueue([]);
    setIndex(0);
    setInput("");
    setVerdict(null);
    setSolved([]);
    setSkipped(0);
    setWrongAttempts(0);
    setRemaining(config.seconds);
    setLanded(null);
    setMissed([]);
    setResult(null);
    recorded.current = false;
  }, [config.seconds]);

  // Changing the configuration abandons whatever was set up for the old one.
  useEffect(() => reset(), [reset, config.band]);

  const start = useCallback(() => {
    setQueue(buildQueue(config, Date.now()));
    setIndex(0);
    setSolved([]);
    setSkipped(0);
    setWrongAttempts(0);
    setInput("");
    setVerdict(null);
    setLanded(null);
    setMissed([]);
    setResult(null);
    recorded.current = false;
    endsAt.current = Date.now() + config.seconds * 1000;
    problemStartedAt.current = Date.now();
    setRemaining(config.seconds);
    setStatus("running");
  }, [config]);

  // The clock. Ticking four times a second keeps the bar smooth without a rAF loop.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) setStatus("done");
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  // Freeze the result once, on the transition into "done". The problem still on screen when the
  // clock stopped counts as missed too — it is exactly the one the player most wants to see.
  useEffect(() => {
    if (status !== "done" || recorded.current) return;
    recorded.current = true;
    const inFlight = queue[index];
    const finished: SprintResult = {
      solved,
      skipped,
      wrongAttempts,
      missed: inFlight && !missed.includes(inFlight) ? [...missed, inFlight] : missed,
      score: sprintScore(solved, skipped),
      config,
    };
    setResult(finished);
    recordSprint(config, { score: finished.score, solved: solved.length });
  }, [status, solved, skipped, wrongAttempts, missed, queue, index, config]);

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setInput("");
    setVerdict(null);
    problemStartedAt.current = Date.now();
  }, []);

  const problem = status === "running" ? (queue[index] ?? null) : null;

  const submit = useCallback(() => {
    if (status !== "running" || !problem || !input.trim()) return;
    const graded = gradeAnswer(problem, input);
    if (graded.status !== "correct") {
      setVerdict(graded);
      if (graded.status !== "unparseable") setWrongAttempts((n) => n + 1);
      return;
    }

    const seconds = Math.max(1, Math.round((Date.now() - problemStartedAt.current) / 1000));
    const progress = getProgress();
    const earned = scoreAttempt({
      difficulty: problem.difficulty,
      seconds,
      hintsUsed: 0,
      wrongAttempts: 0,
      streak: 0,
      mode: "training",
      repeat: hasSolved(progress, problem.id),
    });
    recordTrainingSolve({
      problemId: problem.id,
      seconds,
      hintsUsed: 0,
      wrongAttempts: 0,
      xp: earned.total,
      score: earned.total,
    });

    setSolved((list) => [...list, problem]);
    setLanded((prev) => ({ problem, points: solvePoints(problem.difficulty), nonce: (prev?.nonce ?? 0) + 1 }));
    advance();
  }, [status, problem, input, advance]);

  const skip = useCallback(() => {
    if (status !== "running" || !problem) return;
    setSkipped((n) => n + 1);
    setMissed((list) => [...list, problem]);
    setLanded(null);
    advance();
  }, [status, problem, advance]);

  const end = useCallback(() => {
    setStatus((s) => (s === "running" ? "done" : s));
  }, []);

  const onInput = useCallback((v: string) => {
    setInput(v);
    setVerdict(null);
  }, []);

  return {
    status,
    problem,
    input,
    verdict,
    remaining,
    solved,
    skipped,
    wrongAttempts,
    liveScore: sprintScore(solved, skipped),
    result,
    landed,
    setInput: onInput,
    submit,
    skip,
    start,
    end,
    reset,
  };
}
