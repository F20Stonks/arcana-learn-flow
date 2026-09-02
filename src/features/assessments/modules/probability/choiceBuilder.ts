/**
 * Turns a template's raw {correct, distractors} into a graded `choice` AssessmentItem.
 *
 * Every distractor is the value a *specific*, named wrong approach produces — the name lives in
 * `Distractor.reasoning` and ends up in the debrief explanation, never during the run. This file
 * enforces the shared invariants every probability item must satisfy (matching what
 * firms/firms.test.ts checks generically, plus the stricter rules this task calls for): distinct
 * option ids, distinct option labels, the correct answer present among the choices, no distractor
 * numerically equal to the answer, and — for probability-valued templates — no distractor outside
 * [0, 1].
 */
import type { AssessmentItem } from "../../types";
import { shuffle } from "../../engine/rng";
import { formatValue, nearlyEqual } from "./format";

export interface Distractor {
  value: number;
  /** The specific wrong approach that produces this value, e.g. "inverted the conditional". */
  reasoning: string;
}

export interface TemplateResult {
  tag: string;
  prompt: string;
  correct: number;
  /** At least (optionsCount - 1) of these must survive de-duplication — see buildChoiceItem. */
  distractors: Distractor[];
  explanation: string;
  /** True when `correct` and every distractor must lie in [0, 1]. */
  isProbability?: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E"] as const;

class InsufficientDistractorsError extends Error {}

function buildChoiceItem(rng: () => number, id: string, result: TemplateResult, optionsCount: number): AssessmentItem {
  if (result.isProbability && (result.correct < -1e-9 || result.correct > 1 + 1e-9)) {
    throw new InsufficientDistractorsError(
      `template "${result.tag}" produced an out-of-range probability correct answer: ${result.correct}`,
    );
  }

  const seenValues: number[] = [result.correct];
  const usable: Distractor[] = [];
  for (const d of result.distractors) {
    if (result.isProbability && (d.value < -1e-9 || d.value > 1 + 1e-9)) continue;
    if (seenValues.some((v) => nearlyEqual(v, d.value))) continue;
    // Also require visually-distinct labels, since two numerically-close-but-unequal values can
    // still round to the same displayed text.
    const label = formatValue(d.value);
    if (usable.some((u) => formatValue(u.value) === label)) continue;
    if (formatValue(result.correct) === label) continue;
    seenValues.push(d.value);
    usable.push(d);
  }

  const needed = optionsCount - 1;
  if (usable.length < needed) {
    throw new InsufficientDistractorsError(
      `template "${result.tag}" needs ${needed} distinct distractors, got ${usable.length} for prompt: ${result.prompt}`,
    );
  }

  const chosenDistractors = shuffle(usable, rng).slice(0, needed);
  const pool = shuffle(
    [
      ...chosenDistractors.map((d) => ({ label: formatValue(d.value), correct: false, reasoning: d.reasoning })),
      { label: formatValue(result.correct), correct: true, reasoning: "" },
    ],
    rng,
  );

  const choices = pool.map((c, i) => ({ id: LETTERS[i], label: c.label }));
  const correctIndex = pool.findIndex((c) => c.correct);
  const wrongApproaches = pool.filter((c) => !c.correct).map((c) => c.reasoning);

  return {
    id,
    tag: result.tag,
    prompt: result.prompt,
    answer: choices[correctIndex].id,
    choices,
    explanation:
      wrongApproaches.length > 0
        ? `${result.explanation} Common mistakes: ${wrongApproaches.join("; ")}.`
        : result.explanation,
  };
}

/**
 * Runs `templateFn` (which draws fresh parameters from `rng` each call) until it yields a valid,
 * fully-distinct set of options, retrying on the rare parameter draw that collapses two
 * distractors onto the same value. Determinism is preserved — a retry just consumes more of the
 * same seeded stream, so a given seed still reproduces the same eventual item.
 */
export function generateChoiceItem(
  rng: () => number,
  id: string,
  optionsCount: number,
  templateFn: () => TemplateResult,
  maxAttempts = 25,
): AssessmentItem {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return buildChoiceItem(rng, id, templateFn(), optionsCount);
    } catch (err) {
      if (!(err instanceof InsufficientDistractorsError)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
