/**
 * Answer checking.
 *
 * The house rule (carried over from the Integral Arena) is that a student's answer must never be
 * misread. These tests are numeric and typed under extreme time pressure, so the checker accepts
 * the forms a hurrying human actually produces — "0.25", ".25", "1/4", "1,250", "−3" with a real
 * minus sign — and nothing that would let a wrong answer through.
 *
 * Deliberately NOT a general expression parser: an OA answer is a number or a choice id, never an
 * algebraic form. src/features/integrals/answer.ts is where the permissive parser lives, and it
 * stays there.
 */
import type { AssessmentItem } from "../types";

/** Everything that is or looks like a minus sign, and the separators people type into numbers. */
const MINUS = /[−‒–—‐‑]/g;

export function normaliseNumeric(raw: string): string {
  return raw
    .trim()
    .replace(MINUS, "-")
    .replace(/\s+/g, "")
    // Thousands separators, but only between digit groups — never a decimal comma.
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/^\+/, "");
}

/**
 * Parses "3", "-3", ".5", "1/4", "-7/2". Returns null when the string is not one of those, which
 * the caller treats as a wrong answer rather than guessing at intent.
 */
export function parseNumericAnswer(raw: string): number | null {
  const s = normaliseNumeric(raw);
  if (!s) return null;

  const fraction = /^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/.exec(s);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }

  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/**
 * Relative tolerance, so 1e-9 works for both `7` and `0.000004`. Exact integers still compare
 * exactly, which is what every arithmetic module needs.
 */
export function numericallyEqual(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** The default `ModuleSpec.check`. Modules override it only when they need something else. */
export function defaultCheck(item: AssessmentItem, raw: string): boolean {
  if (item.choices) return raw === item.answer;

  const given = parseNumericAnswer(raw);
  const expected = parseNumericAnswer(item.answer);
  if (given !== null && expected !== null) return numericallyEqual(given, expected);

  // Non-numeric typed answers (letter sequences, short text): case- and space-insensitive.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  return norm(raw) === norm(item.answer);
}
