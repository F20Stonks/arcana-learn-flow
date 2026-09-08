import { useCallback, useMemo, useRef, useState } from "react";
import { gradeAnswer } from "../answer";
import { recordAttempt } from "../attempts";
import { recordTrainingSolve } from "../progress";
import { PROBLEM_BY_ID } from "../problems";
import {
  EXERCISE_XP,
  gradeExercise,
  isScored,
  type Exercise,
  type ExerciseResponse,
  type ExerciseResult,
} from "../ukuib/exercises";
import { HEARTS_PER_LESSON, planLesson, type LessonPlan } from "../ukuib/lesson";
import { crownState, metSkillIds, recordLesson } from "../ukuib/ukuibProgress";

export type LessonPhase = "running" | "failed" | "done";

export interface LessonRunApi {
  plan: LessonPlan;
  index: number;
  current: Exercise | undefined;
  phase: LessonPhase;
  hearts: number;
  /** Correct answers / scored exercises so far. Reading is never scored. */
  correct: number;
  scored: number;
  xp: number;
  /** The verdict on the exercise just answered — null while it is still open. */
  result: ExerciseResult | null;
  /** True once the current exercise has been answered and the feedback is showing. */
  answered: boolean;
  submit: (response: ExerciseResponse) => void;
  next: () => void;
  retry: () => void;
  /**
   * Called by the answer field on every keystroke. Splits a solve's clock into "how long before
   * they knew where to start" and "how long the writing took" — the same two clocks every other
   * run hook in this feature records, so course attempts sit alongside the rest in the log rather
   * than arriving with the timing fields blank.
   */
  noteKeystroke: () => void;
}

/**
 * One run through one lesson.
 *
 * Owns the hearts, the running score, and the two side effects a finished lesson has: the course's
 * own crown/XP record, and — for the `solve` exercises specifically — the ordinary Arena records a
 * training solve would write. That second one is deliberate: a problem solved here is a problem
 * solved, and it should count towards the same streak, the same mastery and the same attempt log
 * that everything else in this app writes to. A course that kept its own private scoreboard would
 * make a student's progress depend on which door they came in through.
 *
 * The lesson is planned once per attempt, so a retry after running out of hearts serves the SAME
 * lesson rather than a fresh draw — the retry measures the student, not the shuffle. Finishing a
 * lesson and coming back bumps the attempt counter instead, which is what earns a new draw.
 */
export function useUkuibLesson(skillId: string): LessonRunApi {
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [hearts, setHearts] = useState(HEARTS_PER_LESSON);
  const [correct, setCorrect] = useState(0);
  const [scored, setScored] = useState(0);
  const [xp, setXp] = useState(0);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const [phase, setPhase] = useState<LessonPhase>("running");
  const exerciseStartedAt = useRef(Date.now());
  const firstKeystrokeAt = useRef<number | null>(null);
  const recorded = useRef(false);

  // The seed is fixed per (skill, attempt): stable within a run, and stable across a retry of the
  // same attempt, but a genuinely new draw once the student has finished and comes back.
  const plan = useMemo(() => {
    const state = crownState();
    return planLesson(skillId, hashSeed(skillId) + attempt * 7919, {
      crownOf: state.crownOf,
      metSkillIds: metSkillIds(),
    });
  }, [skillId, attempt]);

  const current = plan.exercises[index];

  const noteKeystroke = useCallback(() => {
    if (firstKeystrokeAt.current === null) firstKeystrokeAt.current = Date.now();
  }, []);

  const finish = useCallback(
    (completed: boolean, finalCorrect: number, finalScored: number, finalXp: number) => {
      if (recorded.current) return;
      recorded.current = true;
      recordLesson({
        skillId,
        accuracy: finalScored > 0 ? finalCorrect / finalScored : 1,
        xp: finalXp,
        completed,
      });
    },
    [skillId],
  );

  const submit = useCallback(
    (response: ExerciseResponse) => {
      const ex = plan.exercises[index];
      if (!ex || result !== null || phase !== "running") return;

      let outcome: ExerciseResult;
      if (ex.kind === "solve" && response.kind === "solve") {
        // Solving goes through the ordinary grader against the real Problem, and writes the same
        // records a training attempt writes — see this hook's own doc comment for why.
        const problem = PROBLEM_BY_ID[ex.problemId];
        if (!problem) {
          outcome = { correct: false };
        } else {
          const verdict = gradeAnswer(problem, response.input);
          outcome = { correct: verdict.status === "correct", verdict };
          const now = Date.now();
          recordAttempt({
            problemId: problem.id,
            mode: "ukuib",
            verdictClass: verdict.status,
            submitted: response.input,
            hintsOpen: 0,
            wrongAttemptsSoFar: 0,
            msToFirstKeystroke: firstKeystrokeAt.current
              ? firstKeystrokeAt.current - exerciseStartedAt.current
              : null,
            msFirstKeystrokeToSubmit: firstKeystrokeAt.current
              ? now - firstKeystrokeAt.current
              : null,
          });
          if (verdict.status === "correct") {
            recordTrainingSolve({
              problemId: problem.id,
              seconds: Math.max(1, Math.round((now - exerciseStartedAt.current) / 1000)),
              hintsUsed: 0,
              wrongAttempts: 0,
              xp: EXERCISE_XP.solve,
              score: EXERCISE_XP.solve,
            });
          }
        }
      } else {
        outcome = gradeExercise(ex, response);
      }

      setResult(outcome);

      const wasScored = isScored(ex);
      const nextCorrect = correct + (outcome.correct && wasScored ? 1 : 0);
      const nextScored = scored + (wasScored ? 1 : 0);
      const nextXp = xp + (outcome.correct ? EXERCISE_XP[ex.kind] : 0);
      if (wasScored) {
        setCorrect(nextCorrect);
        setScored(nextScored);
      }
      if (outcome.correct) setXp(nextXp);

      if (wasScored && !outcome.correct) {
        const left = hearts - 1;
        setHearts(left);
        if (left <= 0) {
          setPhase("failed");
          finish(false, nextCorrect, nextScored, nextXp);
        }
      }
    },
    [plan, index, result, phase, correct, scored, xp, hearts, finish],
  );

  const next = useCallback(() => {
    if (phase !== "running") return;
    const last = index >= plan.exercises.length - 1;
    setResult(null);
    firstKeystrokeAt.current = null;
    exerciseStartedAt.current = Date.now();
    if (last) {
      setPhase("done");
      finish(true, correct, scored, xp);
    } else {
      setIndex((i) => i + 1);
    }
  }, [phase, index, plan.exercises.length, correct, scored, xp, finish]);

  const retry = useCallback(() => {
    recorded.current = false;
    setIndex(0);
    setResult(null);
    setCorrect(0);
    setScored(0);
    setXp(0);
    setPhase("running");
    setHearts(plan.hearts);
    exerciseStartedAt.current = Date.now();
    firstKeystrokeAt.current = null;
    // A completed lesson earns a fresh draw; a failed one is replayed exactly.
    if (phase === "done") setAttempt((a) => a + 1);
  }, [plan.hearts, phase]);

  return {
    plan,
    index,
    current,
    phase,
    hearts,
    correct,
    scored,
    xp,
    result,
    answered: result !== null,
    submit,
    next,
    retry,
    noteKeystroke,
  };
}

/** Stable per-skill seed so two students on the same skill see the same first lesson. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 100000);
}
