/**
 * The ambiguity verifier.
 *
 * A generated sequence prefix can legitimately admit more than one "next" term. Marking a
 * candidate wrong for a defensible answer is the worst thing this module could do, so nothing
 * ships without clearing this check: run the independent fitter battery (fitters.ts) over the
 * prefix, and reject the item if any fit *at or below* the intended rule's own complexity predicts
 * a different next term than the one the generator drew.
 *
 * The "at or below" direction is deliberate and asymmetric: a MORE complex alternative explanation
 * almost always exists for any short prefix (with enough free parameters you can fit anything), so
 * penalizing a simple, well-supported rule for a wild higher-complexity coincidence would reject
 * good items for no reason. What actually burns a candidate is a *simpler or equally simple* rule
 * disagreeing — that is a real, defensible alternative reading, not a contrivance.
 */
import { runFitters, type Fit } from "./fitters";

export interface AmbiguityResult {
  ambiguous: boolean;
  /** Every fit at or below the intended complexity that disagreed with the intended next term. */
  conflicts: Fit[];
  /** Every fit the battery found, for debugging/tests. */
  fits: Fit[];
}

/** Small slack purely to absorb float noise in the log2 coefficient penalty at an exact tie. */
const COMPLEXITY_SLACK = 1e-6;

export function checkAmbiguityNumeric(
  prefix: number[],
  intendedNext: number,
  intendedComplexity: number,
): AmbiguityResult {
  const fits = runFitters(prefix);
  const conflicts = fits.filter(
    (f) => f.complexity <= intendedComplexity + COMPLEXITY_SLACK && Math.abs(f.nextTerm - intendedNext) > 1e-6,
  );
  return { ambiguous: conflicts.length > 0, conflicts, fits };
}

export function letterToOffset(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

export function offsetToLetter(offset: number): string {
  return String.fromCharCode(65 + offset);
}

/** Same check, over a letter sequence: reduce to alphabet offsets and reuse the numeric battery. */
export function checkAmbiguityLetters(
  prefix: string[],
  intendedNextLetter: string,
  intendedComplexity: number,
): AmbiguityResult {
  const offsets = prefix.map(letterToOffset);
  const intendedNext = letterToOffset(intendedNextLetter);
  return checkAmbiguityNumeric(offsets, intendedNext, intendedComplexity);
}

/**
 * A sentinel for families the algebraic fitter battery cannot itself express (digit-sum
 * recurrences, and similar "apply a fixed nonlinear operation" rules). Using +Infinity means: ANY
 * successful competing fit at all — of whatever complexity — disqualifies the item. That is the
 * conservative choice for these families: an algebraic fitter that happens to *also* explain a
 * digit-sum-generated prefix is exactly the failure mode a candidate would hit (a plain-looking
 * sequence that "coincidentally" also reads as arithmetic for the next term), so any such
 * coincidence must reject the item outright, regardless of how many parameters the coincidence
 * happened to need.
 */
export const EXOTIC_COMPLEXITY = Number.POSITIVE_INFINITY;
