/**
 * Speed-arithmetic item generator.
 *
 * Every branch computes its answer in integers and formats at the end. That is not fussiness:
 * `3.4 + 12.7` in floating point is 16.099999999999998, and an assessment that marks a correct
 * "16.1" wrong is the single worst thing this feature could do.
 */
import type { AssessmentItem, ItemInputKind } from "../../types";
import { pick, randInt, shuffle, weightedPick } from "../../engine/rng";
import type { ArithmeticOp, ArithmeticProfile } from "./profiles";
import { fromScaled, gcd } from "./format";
import { generateDistractors, type DistractorInput } from "./distractors";

interface Built {
  prompt: string;
  answer: string;
  tag: ArithmeticOp;
  /** Feeds the distractor generator for choice-mode items; ignored in typed mode. */
  distractorInput: DistractorInput;
}

function build(op: ArithmeticOp, rng: () => number, profile: ArithmeticProfile): Built {
  switch (op) {
    case "add": {
      const a = randInt(12, 899, rng);
      const b = randInt(12, 899, rng);
      return { prompt: `${a} + ${b}`, answer: String(a + b), tag: op, distractorInput: { op: "add", a, b } };
    }

    case "sub": {
      const a = randInt(20, 950, rng);
      const b = profile.allowNegative ? randInt(20, 950, rng) : randInt(11, a, rng);
      return { prompt: `${a} − ${b}`, answer: String(a - b), tag: op, distractorInput: { op: "sub", a, b } };
    }

    case "mul_2x1": {
      const a = randInt(12, 99, rng);
      const b = randInt(3, 9, rng);
      return { prompt: `${a} × ${b}`, answer: String(a * b), tag: op, distractorInput: { op: "mul", a, b } };
    }

    case "mul_2x2": {
      const a = randInt(12, 49, rng);
      const b = randInt(11, 39, rng);
      return { prompt: `${a} × ${b}`, answer: String(a * b), tag: op, distractorInput: { op: "mul", a, b } };
    }

    case "div_exact": {
      // Built from the quotient outwards so the division always lands on an integer — there is
      // never a remainder to guess at, which is how every one of these tests sets division.
      const divisor = randInt(3, 19, rng);
      const quotient = randInt(4, 60, rng);
      return {
        prompt: `${divisor * quotient} ÷ ${divisor}`,
        answer: String(quotient),
        tag: op,
        distractorInput: { op: "div", divisor, quotient },
      };
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
        distractorInput: { op: "decimal_addsub", a, b, plus, places: 1 },
      };
    }

    case "decimal_mul": {
      // One decimal factor against a whole number keeps the item a six-second item.
      const a = randInt(11, 95, rng);
      const b = randInt(2, 40, rng);
      return {
        prompt: `${fromScaled(a, 1)} × ${b}`,
        answer: fromScaled(a * b, 1),
        tag: op,
        distractorInput: { op: "decimal_mul", a, b, places: 1 },
      };
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
        distractorInput: { op: "fraction_addsub", n1, d1, n2, d2, plus },
      };
    }

    case "percent_of": {
      const percent = pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75], rng);
      // Chosen so the answer is a whole number — a percentage item tests the shortcut, not
      // long division.
      const base = randInt(2, 40, rng) * 20;
      return {
        prompt: `${percent}% of ${base}`,
        answer: String((percent * base) / 100),
        tag: op,
        distractorInput: { op: "percent_of", percent, base },
      };
    }

    case "missing_operand": {
      const a = randInt(3, 19, rng);
      const b = randInt(4, 40, rng);
      if (rng() < 0.5) {
        return {
          prompt: `${a} × ? = ${a * b}`,
          answer: String(b),
          tag: op,
          distractorInput: { op: "missing_operand", a, b, kind: "mul" },
        };
      }
      return {
        prompt: `? + ${a} = ${a + b}`,
        answer: String(b),
        tag: op,
        distractorInput: { op: "missing_operand", a, b, kind: "add" },
      };
    }
  }
}

export interface ArithmeticConfig {
  profile: ArithmeticProfile;
  /** Defaults to "typed-number". "choice" builds four options — Flow Traders' math test. */
  input?: ItemInputKind;
}

export function generateArithmeticItem(
  rng: () => number,
  index: number,
  config: ArithmeticConfig,
): AssessmentItem {
  const op = weightedPick(config.profile.weights, rng);
  const built = build(op, rng, config.profile);
  const id = `${config.profile.id}-${index}-${Math.floor(rng() * 1e9)}`;

  if (config.input === "choice") {
    const distractors = generateDistractors(built.distractorInput, built.answer, rng);
    // Shuffle the four *values* rather than assigning fixed ids to fixed slots, so which id ends
    // up correct varies paper to paper — a choice test where the answer is always option "a" is
    // not a choice test.
    const values = shuffle([built.answer, ...distractors], rng);
    const choices = values.map((label, i) => ({ id: `opt-${i}`, label }));
    const answerId = choices[values.indexOf(built.answer)].id;
    return { id, tag: built.tag, prompt: built.prompt, answer: answerId, choices };
  }

  return { id, tag: built.tag, prompt: built.prompt, answer: built.answer };
}
