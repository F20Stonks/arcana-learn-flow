/**
 * Checking an OA answer.
 *
 * Deliberately built on the integrals feature's `normalize()` rather than a second parser. That
 * one has fifty tests behind it and already accepts every way a person writes a number under time
 * pressure — `1/8`, `.125`, `12 1/2`, `2e3`, a pasted `\frac{1}{8}` — and the owner's standing
 * rule is that a right answer must never be misread. Two parsers would mean two sets of bugs and
 * one of them untested.
 *
 * No model call anywhere on this path: every answer here is decidable arithmetic, checked in the
 * candidate's own browser.
 */
import { parse } from "mathjs";
import { normalize } from "@/features/integrals/answer";
import type { Answer } from "./types";

/** The number a candidate meant, or null when it isn't one. */
export function evaluateNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A trailing percent sign means the number, not a division — "50%" answering "what percent" is 50.
  const withoutPercent = trimmed.replace(/%\s*$/, "");
  try {
    const value = parse(normalize(withoutPercent)).evaluate({});
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Whether an answer counts.
 *
 * Numeric answers are exact by default because OA arithmetic is exact; the tolerance exists for
 * the few generators whose answer is genuinely a decimal expansion. Estimation is graded on a
 * band, which is the honest thing to do — a Fermi question has no single right number.
 */
export function isCorrect(answer: Answer, given: string | null): boolean {
  if (given === null || !given.trim()) return false;

  if (answer.type === "choice") {
    const index = Number(given);
    return Number.isInteger(index) && index === answer.index;
  }

  const value = evaluateNumeric(given);
  if (value === null) return false;

  if (answer.type === "range") return value >= answer.low && value <= answer.high;

  // The epsilon is not slack in the tolerance, it is protection for its boundary. A probability
  // of 3/8 rounds to 0.38, which sits *exactly* 0.005 from the true value — and in binary that
  // subtraction lands at 0.0050000000000000044, so a bare `<=` rejects a correctly rounded answer.
  // Nothing is worse than telling a candidate their right answer is wrong.
  const tolerance = answer.tolerance ?? 0;
  return Math.abs(value - answer.value) <= tolerance + 1e-9;
}

/** What the right answer looks like written out, for the review screen. */
export function answerText(answer: Answer, choices?: string[]): string {
  if (answer.type === "choice") return choices?.[answer.index] ?? `option ${answer.index + 1}`;
  if (answer.type === "range") return `anything from ${answer.low} to ${answer.high}`;
  return String(Number(answer.value.toFixed(6)));
}
