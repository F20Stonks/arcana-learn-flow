import { describe, expect, it } from "vitest";
import { seededRng, randInt, pick } from "../../engine/rng";
import { parseNumericAnswer } from "../../engine/check";
import { generateDistractors, transposeAdjacentDigits, type DistractorInput } from "./distractors";
import { fromScaled } from "./format";

/**
 * The distractor generator is the part of this feature most likely to be subtly wrong — a
 * collision that silently drops below three options, or a candidate that isn't parseable as a
 * numeric answer, ships a broken multiple-choice item straight to a candidate. So this file, like
 * generate.test.ts, never trusts the generator's own arithmetic: every produced string is
 * independently re-parsed and checked.
 */

describe("transposeAdjacentDigits", () => {
  it("swaps the last two digits", () => {
    expect(transposeAdjacentDigits(1234)).toBe(1243);
    expect(transposeAdjacentDigits(60)).toBe(6);
    expect(transposeAdjacentDigits(120)).toBe(102);
  });

  it("preserves sign", () => {
    expect(transposeAdjacentDigits(-56)).toBe(-65);
  });

  it("leaves single digits unchanged (nothing to transpose)", () => {
    expect(transposeAdjacentDigits(7)).toBe(7);
    expect(transposeAdjacentDigits(0)).toBe(0);
  });
});

describe("generateDistractors — general contract", () => {
  const OPS: DistractorInput[] = [
    { op: "add", a: 234, b: 567 },
    { op: "sub", a: 812, b: 345 },
    { op: "mul", a: 23, b: 7 },
    { op: "mul", a: 27, b: 33 },
    { op: "div", divisor: 7, quotient: 34 },
    { op: "decimal_addsub", a: 1234, b: 567, plus: true, places: 1 },
    { op: "decimal_addsub", a: 1234, b: 567, plus: false, places: 1 },
    { op: "decimal_mul", a: 45, b: 12, places: 1 },
    { op: "fraction_addsub", n1: 1, d1: 3, n2: 1, d2: 4, plus: true },
    { op: "fraction_addsub", n1: 2, d1: 5, n2: 1, d2: 3, plus: false },
    { op: "percent_of", percent: 25, base: 200 },
    { op: "missing_operand", a: 7, b: 12, kind: "mul" },
    { op: "missing_operand", a: 9, b: 21, kind: "add" },
    // Small-number edge cases where the plausible-error list is likely to collide with itself.
    { op: "div", divisor: 3, quotient: 4 },
    { op: "add", a: 12, b: 13 },
    { op: "sub", a: 21, b: 20 },
  ];

  function correctAnswerFor(input: DistractorInput): string {
    switch (input.op) {
      case "add":
        return String(input.a + input.b);
      case "sub":
        return String(input.a - input.b);
      case "mul":
        return String(input.a * input.b);
      case "div":
        return String(input.quotient);
      case "decimal_addsub": {
        const scaled = input.plus ? input.a + input.b : input.a - input.b;
        return fromScaled(scaled, input.places);
      }
      case "decimal_mul":
        return fromScaled(input.a * input.b, input.places);
      case "fraction_addsub": {
        const num = input.plus ? input.n1 * input.d2 + input.n2 * input.d1 : input.n1 * input.d2 - input.n2 * input.d1;
        const den = input.d1 * input.d2;
        const gcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) : gcd(y, x % y));
        const g = gcd(num, den) || 1;
        const rn = num / g;
        const rd = den / g;
        return rd === 1 ? String(rn) : `${rn}/${rd}`;
      }
      case "percent_of":
        return String((input.percent * input.base) / 100);
      case "missing_operand":
        return String(input.b);
    }
  }

  for (const input of OPS) {
    describe(JSON.stringify(input), () => {
      const correct = correctAnswerFor(input);

      it("returns exactly three distractors, all distinct, none equal to the correct answer", () => {
        const rng = seededRng(1);
        const distractors = generateDistractors(input, correct, rng);
        expect(distractors.length).toBe(3);
        expect(new Set(distractors).size).toBe(3);
        for (const d of distractors) expect(d).not.toBe(correct);
      });

      it("every distractor parses as a number (or a/b fraction)", () => {
        const rng = seededRng(2);
        const distractors = generateDistractors(input, correct, rng);
        for (const d of distractors) {
          expect(parseNumericAnswer(d), `"${d}" from ${JSON.stringify(input)} did not parse`).not.toBeNull();
        }
      });

      it("is deterministic for a given seed", () => {
        const runOnce = () => generateDistractors(input, correct, seededRng(42));
        expect(runOnce()).toEqual(runOnce());
      });
    });
  }
});

describe("generateDistractors — specific error classes named in the design", () => {
  it("sub: includes the sign-flipped (operand-order-reversed) distractor", () => {
    const input: DistractorInput = { op: "sub", a: 300, b: 120 };
    const correct = "180"; // 300 - 120
    const distractors = generateDistractors(input, correct, seededRng(1));
    expect(distractors).toContain("-180"); // b - a, the classic reversed subtraction
  });

  it("div: includes the product (dividend) mistaken for the quotient, and the divisor itself", () => {
    const input: DistractorInput = { op: "div", divisor: 6, quotient: 7 };
    const correct = "7";
    const distractors = generateDistractors(input, correct, seededRng(1));
    expect(distractors).toContain("42"); // divisor * quotient, i.e. the dividend
    expect(distractors).toContain("6"); // the divisor, returned instead of dividing
  });

  it("percent_of: includes the complement of the percentage", () => {
    const input: DistractorInput = { op: "percent_of", percent: 20, base: 200 };
    const correct = "40";
    const distractors = generateDistractors(input, correct, seededRng(1));
    expect(distractors).toContain("160"); // (100 - 20)% of 200
  });

  it("decimal_mul: includes both a 10x-too-big and a 10x-too-small misplaced decimal", () => {
    const input: DistractorInput = { op: "decimal_mul", a: 15, b: 4, places: 1 }; // 1.5 * 4 = 6
    const correct = "6";
    const distractors = generateDistractors(input, correct, seededRng(1));
    expect(distractors).toContain("60"); // decimal point one place too far right
    expect(distractors).toContain("0.6"); // one place too far left
  });

  it("add: includes the other operand returned as-is, once higher-priority candidates collide", () => {
    // A single-digit correct answer makes the digit-transposition candidate a no-op (nothing to
    // transpose), which is filtered as a duplicate of the correct answer — freeing a slot that
    // the "wrote one operand down instead of the sum" candidate then fills.
    const input: DistractorInput = { op: "add", a: 6, b: 1 };
    const distractors = generateDistractors(input, "7", seededRng(1));
    expect(distractors).toContain("6"); // a, returned instead of a + b
  });

  it("mul: includes the off-by-one-on-one-factor near-miss ahead of a bare operand return", () => {
    // a*(b±1) and (a±1)*b rank above "operand returned" in plausibility, so they are what
    // actually appear for a typical two-factor product — this is the mechanism doing its job,
    // not a gap: a fast, wrong recount of one factor is a more common slip than copying an
    // operand down verbatim.
    const input: DistractorInput = { op: "mul", a: 17, b: 4 };
    const distractors = generateDistractors(input, "68", seededRng(1));
    expect(distractors).toContain("85"); // 17 * (4 + 1)
    expect(distractors).toContain("51"); // 17 * (4 - 1)
  });

  it("fraction_addsub: includes the straight-across numerator+denominator mistake", () => {
    // 1/3 + 1/4 = 7/12 (correct). The classic wrong technique adds numerators and denominators
    // directly: (1+1)/(3+4) = 2/7.
    const input: DistractorInput = { op: "fraction_addsub", n1: 1, d1: 3, n2: 1, d2: 4, plus: true };
    const distractors = generateDistractors(input, "7/12", seededRng(1));
    expect(distractors).toContain("2/7");
  });
});

describe("generateDistractors — fuzz across the ranges generate.ts actually produces", () => {
  const cases: Array<{ name: string; build: (rng: () => number) => { input: DistractorInput; correct: string } }> = [
    {
      name: "add",
      build: (rng) => {
        const a = randInt(12, 899, rng);
        const b = randInt(12, 899, rng);
        return { input: { op: "add", a, b }, correct: String(a + b) };
      },
    },
    {
      name: "sub",
      build: (rng) => {
        const a = randInt(20, 950, rng);
        const b = randInt(20, 950, rng);
        return { input: { op: "sub", a, b }, correct: String(a - b) };
      },
    },
    {
      name: "mul_2x2",
      build: (rng) => {
        const a = randInt(12, 49, rng);
        const b = randInt(11, 39, rng);
        return { input: { op: "mul", a, b }, correct: String(a * b) };
      },
    },
    {
      name: "div_exact",
      build: (rng) => {
        const divisor = randInt(3, 19, rng);
        const quotient = randInt(4, 60, rng);
        return { input: { op: "div", divisor, quotient }, correct: String(quotient) };
      },
    },
    {
      name: "decimal_mul",
      build: (rng) => {
        const a = randInt(11, 95, rng);
        const b = randInt(2, 40, rng);
        return { input: { op: "decimal_mul", a, b, places: 1 }, correct: fromScaled(a * b, 1) };
      },
    },
    {
      name: "percent_of",
      build: (rng) => {
        const percent = pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75], rng);
        const base = randInt(2, 40, rng) * 20;
        return { input: { op: "percent_of", percent, base }, correct: String((percent * base) / 100) };
      },
    },
  ];

  for (const { name, build } of cases) {
    it(`${name}: holds the contract over 300 random draws`, () => {
      const rng = seededRng(2024);
      for (let i = 0; i < 300; i++) {
        const { input, correct } = build(rng);
        const distractors = generateDistractors(input, correct, rng);
        expect(distractors.length, JSON.stringify({ input, correct, distractors })).toBe(3);
        expect(new Set(distractors).size, JSON.stringify({ input, correct, distractors })).toBe(3);
        for (const d of distractors) {
          expect(d, JSON.stringify({ input, correct, distractors })).not.toBe(correct);
          expect(parseNumericAnswer(d), `"${d}" unparseable for ${JSON.stringify(input)}`).not.toBeNull();
        }
      }
    });
  }
});
