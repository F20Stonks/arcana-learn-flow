import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gradeAnswer } from "../answer";
import { recordAttempt } from "../attempts";
import { getProgress, hasSolved, recordTrainingSolve } from "../progress";
import { scoreAttempt } from "../scoring";
import { assemblePaper, bandForIndex, PAPER_BANDS, PAPER_SECONDS } from "../uk/paper";
import {
  clearPaperSnapshot,
  getPaperSnapshot,
  recordPaperResult,
  savePaperSnapshot,
  type PaperBandResult,
  type PaperResult,
  type PaperRunSnapshot,
  type PaperSlotSnapshot,
} from "../uk/paperHistory";
import type { Problem, Verdict } from "../types";

export type PaperRunStatus = "running" | "done";

export interface PaperRunApi {
  status: PaperRunStatus;
  paper: Problem[];
  slots: PaperSlotSnapshot[];
  currentIndex: number;
  currentProblem: Problem;
  currentSlot: PaperSlotSnapshot;
  verdict: Verdict | null;
  /** Seconds left on the master clock. Frozen while `paused`. */
  remainingSeconds: number;
  paused: boolean;
  result: PaperResult | null;
  attemptedCount: number;
  correctCount: number;
  flaggedCount: number;
  setInput: (v: string) => void;
  submit: () => void;
  toggleFlag: () => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  togglePause: () => void;
  /** Hand the paper in early — same finalisation as running out the clock. */
  submitPaper: () => void;
}

function freshSlots(paper: Problem[]): PaperSlotSnapshot[] {
  return paper.map((p) => ({
    problemId: p.id,
    input: "",
    status: "unattempted",
    flagged: false,
    wrongAttempts: 0,
    secondsSpent: 0,
  }));
}

/**
 * One paper sitting: 30 questions navigable in any order (not the daily/training's
 * one-at-a-time lockstep), a single 120-minute clock with pause/resume, and per-question focus
 * time so the finished report can show the triage cost — time spent on questions that never
 * landed. Reuses gradeAnswer (answer.ts) for grading and shuffled (via assemblePaper, rng.ts) for
 * assembly, per the runbook — nothing about grading is reimplemented here.
 *
 * A live sitting is checkpointed to localStorage after every state change (see the effect near the
 * bottom) so a reload mid-paper resumes exactly where it left off — losing two hours of a mock exam
 * to an accidental refresh is a much bigger deal than losing training's per-problem timer, which is
 * why this gets the persistence training/daily deliberately skip.
 */
export function usePaperRun(seed: number): PaperRunApi {
  const paper = useMemo(() => assemblePaper(seed), [seed]);

  const restored = useMemo(() => {
    const snap = getPaperSnapshot();
    return snap && snap.seed === seed && snap.slots.length === paper.length ? snap : null;
  }, [seed, paper.length]);

  const [status, setStatus] = useState<PaperRunStatus>("running");
  const [slots, setSlots] = useState<PaperSlotSnapshot[]>(() => restored?.slots ?? freshSlots(paper));
  const [currentIndex, setCurrentIndex] = useState(() => restored?.currentIndex ?? 0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => restored?.remainingSeconds ?? PAPER_SECONDS);
  const [paused, setPaused] = useState(() => restored?.paused ?? false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [result, setResult] = useState<PaperResult | null>(null);

  const startedAt = useRef(restored?.startedAt ?? new Date().toISOString());
  const endsAt = useRef(Date.now() + (restored?.remainingSeconds ?? PAPER_SECONDS) * 1000);
  const focusStartedAt = useRef(Date.now());
  const finalized = useRef(false);

  /** Bank the wall-clock time spent looking at `index` into that slot, and restart the focus
   *  clock for whatever's current after. Called on every navigation, pause and finish. */
  const flushFocus = useCallback((index: number, drafts: PaperSlotSnapshot[]): PaperSlotSnapshot[] => {
    const elapsed = Math.max(0, Math.round((Date.now() - focusStartedAt.current) / 1000));
    focusStartedAt.current = Date.now();
    if (elapsed === 0) return drafts;
    const next = drafts.slice();
    next[index] = { ...next[index], secondsSpent: next[index].secondsSpent + elapsed };
    return next;
  }, []);

  const finalize = useCallback(
    (reason: PaperResult["endReason"]) => {
      if (finalized.current) return;
      finalized.current = true;
      setSlots((prev) => {
        const flushed = flushFocus(currentIndex, prev);
        const bands: PaperBandResult[] = PAPER_BANDS.map((band) => {
          const slice = flushed.slice(band.start, band.end);
          return {
            bandId: band.id,
            correct: slice.filter((s) => s.status === "correct").length,
            total: slice.length,
            secondsSpent: slice.reduce((sum, s) => sum + s.secondsSpent, 0),
          };
        });
        const score = flushed.filter((s) => s.status === "correct").length;
        const triageSeconds = flushed
          .filter((s) => s.status !== "correct")
          .reduce((sum, s) => sum + s.secondsSpent, 0);
        const finished = recordPaperResult({
          seed,
          startedAt: startedAt.current,
          finishedAt: new Date().toISOString(),
          endReason: reason,
          score,
          total: flushed.length,
          bands,
          triageSeconds,
          secondsUsed: PAPER_SECONDS - remainingSeconds,
        });
        setResult(finished);
        clearPaperSnapshot();
        return flushed;
      });
      setStatus("done");
    },
    [currentIndex, flushFocus, seed, remainingSeconds],
  );

  // The clock. 250ms ticks (matching useSprintRun's own cadence) for a smooth display, but only
  // while running and not paused; time-up finalises the sitting automatically.
  useEffect(() => {
    if (status !== "running" || paused) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) finalize("time-up");
    }, 250);
    return () => window.clearInterval(id);
  }, [status, paused, finalize]);

  // Checkpoint every meaningful change so a reload resumes exactly where this left off.
  useEffect(() => {
    if (status !== "running") return;
    const snapshot: PaperRunSnapshot = {
      seed,
      startedAt: startedAt.current,
      remainingSeconds,
      paused,
      currentIndex,
      slots,
    };
    savePaperSnapshot(snapshot);
  }, [status, seed, remainingSeconds, paused, currentIndex, slots]);

  const setInput = useCallback((v: string) => {
    setSlots((prev) => {
      const next = prev.slice();
      next[currentIndex] = { ...next[currentIndex], input: v };
      return next;
    });
    setVerdict(null);
  }, [currentIndex]);

  const submit = useCallback(() => {
    setSlots((prev) => {
      const slot = prev[currentIndex];
      if (!slot.input.trim()) return prev;
      const problem = paper[currentIndex];
      const verdictNow = gradeAnswer(problem, slot.input);
      setVerdict(verdictNow);

      recordAttempt({
        problemId: problem.id,
        mode: "paper",
        verdictClass: verdictNow.status,
        submitted: slot.input,
        hintsOpen: 0, // no hints in paper mode — see usePaperRun's doc comment
        wrongAttemptsSoFar: slot.wrongAttempts,
        // "First keystroke" doesn't map cleanly onto a question you can revisit across a two-hour
        // free-navigation sitting the way it does for training's single linear run — left null
        // rather than shipping a value with a muddy definition. See UK_BEE_BURST.md WS-3 notes.
        msToFirstKeystroke: null,
        msFirstKeystrokeToSubmit: null,
      });

      if (verdictNow.status === "correct") {
        if (slot.status !== "correct") {
          const progress = getProgress();
          const score = scoreAttempt({
            difficulty: problem.difficulty,
            seconds: Math.max(1, slot.secondsSpent),
            hintsUsed: 0,
            wrongAttempts: slot.wrongAttempts,
            streak: 0,
            mode: "training",
            repeat: hasSolved(progress, problem.id),
          });
          recordTrainingSolve({
            problemId: problem.id,
            seconds: Math.max(1, slot.secondsSpent),
            hintsUsed: 0,
            wrongAttempts: slot.wrongAttempts,
            xp: score.total,
            score: score.total,
          });
        }
        const next = prev.slice();
        next[currentIndex] = { ...slot, status: "correct" };
        return next;
      }

      if (verdictNow.status === "unparseable") return prev; // a misread expression isn't a wrong answer
      const next = prev.slice();
      next[currentIndex] = {
        ...slot,
        status: slot.status === "correct" ? "correct" : "attempted",
        wrongAttempts: slot.wrongAttempts + 1,
      };
      return next;
    });
  }, [currentIndex, paper]);

  const toggleFlag = useCallback(() => {
    setSlots((prev) => {
      const next = prev.slice();
      next[currentIndex] = { ...next[currentIndex], flagged: !next[currentIndex].flagged };
      return next;
    });
  }, [currentIndex]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= paper.length || index === currentIndex) return;
      setSlots((prev) => flushFocus(currentIndex, prev));
      setCurrentIndex(index);
      setVerdict(null);
    },
    [currentIndex, paper.length, flushFocus],
  );

  const next = useCallback(() => goTo(Math.min(paper.length - 1, currentIndex + 1)), [goTo, currentIndex, paper.length]);
  const prev = useCallback(() => goTo(Math.max(0, currentIndex - 1)), [goTo, currentIndex]);

  const togglePause = useCallback(() => {
    setPaused((was) => {
      const now = !was;
      if (now) {
        setSlots((prev) => flushFocus(currentIndex, prev));
      } else {
        endsAt.current = Date.now() + remainingSeconds * 1000;
        focusStartedAt.current = Date.now();
      }
      return now;
    });
  }, [currentIndex, flushFocus, remainingSeconds]);

  const submitPaper = useCallback(() => finalize("submitted"), [finalize]);

  return {
    status,
    paper,
    slots,
    currentIndex,
    currentProblem: paper[currentIndex],
    currentSlot: slots[currentIndex],
    verdict,
    remainingSeconds,
    paused,
    result,
    attemptedCount: slots.filter((s) => s.status !== "unattempted").length,
    correctCount: slots.filter((s) => s.status === "correct").length,
    flaggedCount: slots.filter((s) => s.flagged).length,
    setInput,
    submit,
    toggleFlag,
    goTo,
    next,
    prev,
    togglePause,
    submitPaper,
  };
}

export { bandForIndex };
