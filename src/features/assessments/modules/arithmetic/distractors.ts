/**
 * Distractor generation for multiple-choice arithmetic items (Flow Traders' math test).
 *
 * A random wrong number is a free mark — a rushed candidate's eye lands on whatever is closest to
 * what their own slip produced, not on an arbitrary number. Each branch below encodes one error
 * class a human under a six-second clock actually makes: a digit off, a sign flipped, a decimal
 * point shifted by a power of ten, two adjacent digits swapped copying the result down, the other
 * operand written down instead of the result, the raw product mistaken for the quotient, or the
 * complement of a percentage taken instead of the percentage itself.
 *
 * Never calls Math.random — like every generator in this feature, `generateDistractors` takes its
 * rng from the caller, so a fixed seed reproduces the same four options every time.
 */
import { fromScaled, formatFraction } from "./format";

export type DistractorInput =
  | { op: "add"; a: number; b: number }
  | { op: "sub"; a: number; b: number }
  | { op: "mul"; a: number; b: number }
  | { op: "div"; divisor: number; quotient: number }
  | { op: "decimal_addsub"; a: number; b: number; plus: boolean; places: number }
  | { op: "decimal_mul"; a: number; b: number; places: number }
  | { op: "fraction_addsub"; n1: number; d1: number; n2: number; d2: number; plus: boolean }
  | { op: "percent_of"; percent: number; base: number }
  | { op: "missing_operand"; a: number; b: number; kind: "mul" | "add" };

/** Swaps the last two digits of |value| — the classic slip when copying a fast mental result down. */
export function transposeAdjacentDigits(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const digits = String(Math.abs(Math.round(value))).split("");
  if (digits.length < 2) return value; // nothing to transpose; the caller de-dupes against `value`
  const n = digits.length;
  [digits[n - 2], digits[n - 1]] = [digits[n - 1], digits[n - 2]];
  return sign * Number(digits.join(""));
}

interface DistractorPlan {
  /**
   * Pre-formatted candidates, most human-plausible first. May contain duplicates of each other or
   * of the correct answer — `generateDistractors` filters both out, so each branch below can list
   * its error classes without worrying about small-number collisions (e.g. a single-digit quotient
   * has nothing to transpose, and `transposeAdjacentDigits` just returns it unchanged).
   */
  candidates: string[];
  /** The correct value in the space `format` expects, for the generic jitter fallback. */
  correctNumeric: number;
  format: (value: number) => string;
}

function planFor(input: DistractorInput): DistractorPlan {
  switch (input.op) {
    case "add": {
      const { a, b } = input;
      const correct = a + b;
      return {
        correctNumeric: correct,
        format: (v) => String(Math.round(v)),
        candidates: [
          String(transposeAdjacentDigits(correct)), // digits swapped writing the total down
          String(correct + 10), // missed a carry
          String(correct - 10),
          String(a), // wrote one operand down instead of the sum
          String(b),
          String(correct + 1),
          String(correct - 1),
        ],
      };
    }

    case "sub": {
      const { a, b } = input;
      const correct = a - b;
      return {
        correctNumeric: correct,
        format: (v) => String(Math.round(v)),
        candidates: [
          String(b - a), // subtracted in the wrong direction — the sign flipped
          String(a + b), // added instead of subtracting
          String(transposeAdjacentDigits(correct)),
          String(correct + 10),
          String(correct - 10),
          String(correct + 1),
          String(correct - 1),
        ],
      };
    }

    case "mul": {
      const { a, b } = input;
      const correct = a * b;
      return {
        correctNumeric: correct,
        format: (v) => String(Math.round(v)),
        candidates: [
          String(a * (b + 1)), // off-by-one on one factor — the single most common slip
          String(a * (b - 1)),
          String((a + 1) * b),
          String((a - 1) * b),
          String(transposeAdjacentDigits(correct)),
          String(a + b), // added instead of multiplying
          String(a), // wrote one operand down instead of the product
          String(b),
        ],
      };
    }

    case "div": {
      const { divisor, quotient } = input;
      return {
        correctNumeric: quotient,
        format: (v) => String(Math.round(v)),
        candidates: [
          String(divisor * quotient), // the product — the dividend itself, mistaken for the quotient
          String(divisor), // wrote the divisor down instead of dividing
          String(quotient + 1),
          String(quotient - 1),
          String(transposeAdjacentDigits(quotient)),
        ],
      };
    }

    case "decimal_addsub": {
      const { a, b, plus, places } = input;
      const scaled = plus ? a + b : a - b;
      const unit = 10 ** places;
      const candidates = [
        fromScaled(scaled, Math.max(0, places - 1)), // decimal point one place too far right (10x too big)
        fromScaled(scaled, places + 1), // one place too far left (10x too small)
        fromScaled(transposeAdjacentDigits(scaled), places),
        fromScaled(scaled + unit, places),
        fromScaled(scaled - unit, places),
        fromScaled(scaled + 1, places),
        fromScaled(scaled - 1, places),
      ];
      if (!plus) candidates.unshift(fromScaled(b - a, places)); // subtracted in the wrong direction
      return { correctNumeric: scaled, format: (v) => fromScaled(Math.round(v), places), candidates };
    }

    case "decimal_mul": {
      const { a, b, places } = input;
      const scaled = a * b;
      return {
        correctNumeric: scaled,
        format: (v) => fromScaled(Math.round(v), places),
        candidates: [
          fromScaled(scaled, Math.max(0, places - 1)), // decimal shifted 10x too big — the classic slip
          fromScaled(scaled, places + 1), // 10x too small
          fromScaled(transposeAdjacentDigits(scaled), places),
          fromScaled(a * (b + 1), places),
          fromScaled(a * (b - 1), places),
        ],
      };
    }

    case "fraction_addsub": {
      const { n1, d1, n2, d2, plus } = input;
      const combinedNum = plus ? n1 + n2 : n1 - n2;
      const correctNum = plus ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
      const correctDen = d1 * d2;
      return {
        correctNumeric: correctNum,
        format: (v) => formatFraction(Math.round(v), correctDen),
        candidates: [
          formatFraction(combinedNum, d1 + d2), // added numerators and denominators straight across
          formatFraction(combinedNum, d1), // ignored the second denominator entirely
          formatFraction(combinedNum, d2), // ignored the first denominator entirely
          formatFraction(plus ? n1 * d2 - n2 * d1 : n1 * d2 + n2 * d1, correctDen), // flipped the operation
        ],
      };
    }

    case "percent_of": {
      const { percent, base } = input;
      const correct = (percent * base) / 100;
      return {
        correctNumeric: correct,
        format: (v) => String(v),
        candidates: [
          String(((100 - percent) * base) / 100), // the complement of the percentage
          String((percent * base) / 10), // decimal point one place too far right (10x too big)
          String((percent * base) / 1000), // one place too far left (10x too small)
          String(base), // wrote the base down instead of taking the percentage
          String(percent), // wrote the percentage figure down instead of computing it
          String(correct + 1),
          String(correct - 1),
        ],
      };
    }

    case "missing_operand": {
      const { a, b, kind } = input;
      const rhs = kind === "mul" ? a * b : a + b;
      return {
        correctNumeric: b,
        format: (v) => String(Math.round(v)),
        candidates: [
          String(rhs), // wrote the total down instead of solving for the unknown
          String(a), // wrote the known operand down instead
          String(transposeAdjacentDigits(b)),
          String(b + 1),
          String(b - 1),
        ],
      };
    }
  }
}

/**
 * Three distractors, distinct from each other and from `correctAnswer`, formatted the same way the
 * correct answer is. Falls back to a small numeric jitter around the correct value — the sign
 * nudged by rng so repeated fallbacks don't all land on the same delta — for the rare input where
 * the plausible-error list collides with itself or with the correct answer.
 */
export function generateDistractors(
  input: DistractorInput,
  correctAnswer: string,
  rng: () => number,
): string[] {
  const plan = planFor(input);
  const seen = new Set<string>([correctAnswer]);
  const out: string[] = [];

  for (const candidate of plan.candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
    if (out.length === 3) return out;
  }

  let delta = 2;
  let guard = 0;
  while (out.length < 3 && guard < 500) {
    guard++;
    const sign = rng() < 0.5 ? 1 : -1;
    const candidate = plan.format(plan.correctNumeric + sign * delta);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
    delta++;
  }
  return out;
}
