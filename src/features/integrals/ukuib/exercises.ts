/**
 * The six exercise types a UKUIB lesson is built from, and how each one is graded.
 *
 * Every grade here is deterministic and local — no model call at runtime, per CLAUDE.md's standing
 * directive #3. Where an exercise asks for a mathematical expression, it goes through the SAME
 * grader the rest of the Arena uses (`answer.ts`), never a second, looser one: a student who types
 * a correct answer must be told they are right on every surface in this app, not just the ones that
 * happened to share a code path.
 *
 * The variety is the point. A technique you can only recognise, or only execute, or only recall the
 * value of, is a technique you don't have under competition pressure — so one lesson mixes
 * recognition, procedure, completion and full solving rather than serving eight of the same thing.
 */
import type { ProblemKind, TechniqueId, Verdict } from "../types";
import { checkDefinite, checkIndefinite } from "../answer";

export type ExerciseKind = "teach" | "recognise" | "order" | "complete" | "value" | "solve";

/** A tip card: the intuition and one worked example, stepped through. Not scored. */
export interface TeachExercise {
  kind: "teach";
  id: string;
  technique: TechniqueId;
  /** Which of the technique's graduated examples to walk through. */
  exampleIndex: number;
}

/** "Which technique cracks this?" — four options, one right. */
export interface RecogniseExercise {
  kind: "recognise";
  id: string;
  problemId: string;
  options: TechniqueId[];
  answer: TechniqueId;
}

/** The beats of a method, shuffled; tap them back into order. Procedure recall, no algebra. */
export interface OrderExercise {
  kind: "order";
  id: string;
  technique: TechniqueId;
  shuffled: string[];
  correct: string[];
}

/**
 * A worked solution with the crux move blanked out; the student supplies the closed form.
 *
 * Only generated for `Completion` records that carry the machine-checkable
 * `integrandExpr`/`resultExpr` mirror — without it there is nothing to grade against, and a
 * self-graded "did you get it?" belongs in the lesson page, not in a scored exercise.
 */
export interface CompleteExercise {
  kind: "complete";
  id: string;
  technique: TechniqueId;
  setup: string[];
  blank: string;
  /** What the reader is being asked to produce, rendered on reveal. */
  answerLatex: string;
  /** The gradeable form of the same thing. */
  answerExpr: string;
  integralKind: ProblemKind;
  domain: [number, number];
}

/** "What is this integral worth?" — from the values deck, four options. */
export interface ValueExercise {
  kind: "value";
  id: string;
  technique: TechniqueId;
  front: string;
  options: string[];
  answer: string;
}

/** A real bank problem, typed or built with the palette. */
export interface SolveExercise {
  kind: "solve";
  id: string;
  problemId: string;
  /** Hints are available at low crowns and withdrawn as the crown rises. */
  hintsAllowed: boolean;
}

export type Exercise =
  | TeachExercise
  | RecogniseExercise
  | OrderExercise
  | CompleteExercise
  | ValueExercise
  | SolveExercise;

/** What the player did. `null` is "advanced without answering", which only `teach` allows. */
export type ExerciseResponse =
  | { kind: "teach" }
  | { kind: "recognise"; choice: TechniqueId }
  | { kind: "order"; ordering: string[] }
  | { kind: "complete"; input: string }
  | { kind: "value"; choice: string }
  | { kind: "solve"; input: string };

export interface ExerciseResult {
  correct: boolean;
  /** Present for the two expression-graded types, so the UI can say *how* it was wrong — the
   *  off-by-a-constant-factor case in particular deserves its own message. */
  verdict?: Verdict;
}

/** Exercises that never cost a heart, however the player answers. */
export function isScored(ex: Exercise): boolean {
  return ex.kind !== "teach";
}

/**
 * Grade one exercise.
 *
 * `solve` is deliberately NOT graded here: it needs the full `Problem` record, and the run hook
 * already owns that path through `gradeAnswer`. Everything else is self-contained.
 */
export function gradeExercise(ex: Exercise, response: ExerciseResponse): ExerciseResult {
  if (ex.kind !== response.kind) {
    return { correct: false };
  }
  switch (ex.kind) {
    case "teach":
      return { correct: true };
    case "recognise":
      return { correct: (response as { choice: TechniqueId }).choice === ex.answer };
    case "value":
      return { correct: (response as { choice: string }).choice === ex.answer };
    case "order": {
      const given = (response as { ordering: string[] }).ordering;
      return {
        correct:
          given.length === ex.correct.length && given.every((s, i) => s === ex.correct[i]),
      };
    }
    case "complete": {
      const input = (response as { input: string }).input;
      const verdict =
        ex.integralKind === "definite"
          ? checkDefinite(input, ex.answerExpr)
          : checkIndefinite(input, ex.answerExpr, ex.domain);
      return { correct: verdict.status === "correct", verdict };
    }
    default:
      return { correct: false };
  }
}

/** How much a correct answer is worth. Solving beats recognising; reading is worth nothing. */
export const EXERCISE_XP: Record<ExerciseKind, number> = {
  teach: 0,
  recognise: 2,
  order: 2,
  value: 3,
  complete: 4,
  solve: 6,
};
