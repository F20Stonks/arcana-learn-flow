/**
 * Speed-arithmetic item generator.
 *
 * Every branch computes its answer in integers and formats at the end. That is not fussiness:
 * `3.4 + 12.7` in floating point is 16.099999999999998, and an assessment that marks a correct
 * "16.1" wrong is the single worst thing this feature could do.
 */
import type { AssessmentItem } from "../../types";
import { pick, randInt, weightedPick } from "../../engine/rng";
import type { ArithmeticOp, ArithmeticProfile } from "./profiles";

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Formats a value held as an integer scaled by 10^places, without touching floating point. */
function fromScaled(scaled: number, places: number): string {
  const sign = scaled < 0 ? "-" : "";
  const digits = String(Math.abs(scaled)).padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const frac = digits.slice(digits.length - places).replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

interface Built {
  prompt: string;
  answer: string;
  tag: ArithmeticOp;
}

function build(op: ArithmeticOp, rng: () => number, profile: ArithmeticProfile): Built {
  switch (op) {
    case "add": {
      const a = randInt(12, 899, rng);
      const b = randInt(12, 899, rng);
      return { prompt: `${a} + ${b}`, answer: String(a + b), tag: op };
    }

    case "sub": {
      const a = randInt(20, 950, rng);
      const b = profile.allowNegative ? randInt(20, 950, rng) : randInt(11, a, rng);
      return { prompt: `${a} − ${b}`, answer: String(a - b), tag: op };
    }

    case "mul_2x1": {
      const a = randInt(12, 99, rng);
      const b = randInt(3, 9, rng);
      return { prompt: `${a} × ${b}`, answer: String(a * b), tag: op };
    }

    case "mul_2x2": {
      const a = randInt(12, 49, rng);
      const b = randInt(11, 39, rng);
      return { prompt: `${a} × ${b}`, answer: String(a * b), tag: op };
    }

    case "div_exact": {
      // Built from the quotient outwards so the division always lands on an integer — there is
      // never a remainder to guess at, which is how every one of these tests sets division.
      const divisor = randInt(3, 19, rng);
      const quotient = randInt(4, 60, rng);
      return { prompt: `${divisor * quotient} ÷ ${divisor}`, answer: String(quotient), tag: op };
    }

    case "decimal_addsub": {
      const a = randInt(15, 4990, rng);
      const b = randInt(15, 4990, rng);
      const plus = rng() < 0.5;
      const result = plus ? a + b : a - b;
      return {
        prompt: `${fromScaled(a, 1)} ${plus ? "+" : "−"} ${fromScaled(b, 1)}`,
        answer: fromScaled(result, 1),
        tag: op,
      };
    }

    case "decimal_mul": {
      // One decimal factor against a whole number keeps the item a six-second item.
      const a = randInt(11, 95, rng);
      const b = randInt(2, 40, rng);
      return { prompt: `${fromScaled(a, 1)} × ${b}`, answer: fromScaled(a * b, 1), tag: op };
    }

    case "fraction_addsub": {
      const denominators = [2, 3, 4, 5, 6, 8, 10, 12];
      const d1 = pick(denominators, rng);
      const d2 = pick(denominators.filter((d) => d !== d1), rng);
      const n1 = randInt(1, d1 - 1, rng);
      const n2 = randInt(1, d2 - 1, rng);
      const plus = rng() < 0.6;
      const num = plus ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
      const den = d1 * d2;
      const g = gcd(num, den) || 1;
      const rn = num / g;
      const rd = den / g;
      return {
        prompt: `$\\frac{${n1}}{${d1}} ${plus ? "+" : "-"} \\frac{${n2}}{${d2}}$`,
        // The checker parses "a/b" as well as its decimal value, so either form is accepted.
        answer: rd === 1 ? String(rn) : `${rn}/${rd}`,
        tag: op,
      };
    }

    case "percent_of": {
      const percent = pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75], rng);
      // Chosen so the answer is a whole number — a percentage item tests the shortcut, not
      // long division.
      const base = randInt(2, 40, rng) * 20;
      return { prompt: `${percent}% of ${base}`, answer: String((percent * base) / 100), tag: op };
    }

    case "missing_operand": {
      const a = randInt(3, 19, rng);
      const b = randInt(4, 40, rng);
      if (rng() < 0.5) return { prompt: `${a} × ? = ${a * b}`, answer: String(b), tag: op };
      return { prompt: `? + ${a} = ${a + b}`, answer: String(b), tag: op };
    }
  }
}

export interface ArithmeticConfig {
  profile: ArithmeticProfile;
}

export function generateArithmeticItem(
  rng: () => number,
  index: number,
  config: ArithmeticConfig,
): AssessmentItem {
  const op = weightedPick(config.profile.weights, rng);
  const { prompt, answer, tag } = build(op, rng, config.profile);
  return { id: `${config.profile.id}-${index}-${Math.floor(rng() * 1e9)}`, tag, prompt, answer };
}
