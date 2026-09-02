/**
 * The generators grade themselves.
 *
 * Same principle as the integrals bank: a question whose stated answer is wrong must fail the
 * suite rather than fail a candidate. Every generator is hammered at every level and each question
 * is fed its own answer back through the real grading path — if `isCorrect` rejects the answer the
 * generator itself produced, something is broken before anyone sits it.
 */
import { describe, expect, it } from "vitest";
import { rng } from "./rng";
import { generateQuestion } from "./generate";
import { isCorrect } from "./grade";
import { clean } from "./generators/arithmetic";
import type { QuestionKind } from "./types";

const KINDS: QuestionKind[] = ["arithmetic", "sequence", "probability", "expected-value"];
const LEVELS = [1, 2, 3, 4, 5];
const PER_LEVEL = 300;

describe.each(KINDS)("the %s generator", (kind) => {
  it.each(LEVELS)("produces a well-formed, self-consistent question at level %i", (level) => {
    const r = rng(level * 7919 + kind.length);
    for (let i = 0; i < PER_LEVEL; i++) {
      const q = generateQuestion(kind, r, level, `t-${i}`);

      expect(q.prompt.trim(), `empty prompt at ${kind} L${level} #${i}`).not.toBe("");
      expect(q.explanation.trim(), `empty explanation at ${kind} L${level} #${i}`).not.toBe("");
      expect(q.kind).toBe(kind);

      if (q.answer.type === "numeric") {
        expect(Number.isFinite(q.answer.value), `non-finite answer: ${q.prompt}`).toBe(true);
        // The candidate typing the exact stored answer must be marked right. This is the whole
        // safety net: it exercises the real parser and the real comparison.
        expect(isCorrect(q.answer, String(q.answer.value)), `own answer rejected: ${q.prompt}`).toBe(
          true,
        );
        // And a different number must not be.
        expect(isCorrect(q.answer, String(q.answer.value + 1))).toBe(false);
      }

      if (q.answer.type === "choice") {
        expect(q.choices, `choice answer with no choices: ${q.prompt}`).toBeDefined();
        expect(q.answer.index).toBeLessThan(q.choices!.length);
        expect(isCorrect(q.answer, String(q.answer.index))).toBe(true);
      }

      if (q.answer.type === "range") {
        expect(q.answer.low).toBeLessThanOrEqual(q.answer.high);
        expect(isCorrect(q.answer, String((q.answer.low + q.answer.high) / 2))).toBe(true);
      }
    }
  });
});

describe("arithmetic answers stay clean", () => {
  it("never asks for a number with floating-point dust in it", () => {
    const r = rng(4242);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 500; i++) {
        const q = generateQuestion("arithmetic", r, level, `c-${i}`);
        if (q.answer.type !== "numeric") continue;
        // 0.30000000000000004 is a question about IEEE 754, not about arithmetic.
        expect(q.answer.value, q.prompt).toBe(clean(q.answer.value));
        expect(String(q.answer.value)).not.toMatch(/\d{8,}/);
      }
    }
  });

  it("keeps every answer typeable under a six-second clock", () => {
    const r = rng(99);
    for (let i = 0; i < 800; i++) {
      const q = generateQuestion("arithmetic", r, 3, `t-${i}`);
      if (q.answer.type !== "numeric") continue;
      const decimals = (String(q.answer.value).split(".")[1] ?? "").length;
      expect(decimals, `${q.prompt} = ${q.answer.value}`).toBeLessThanOrEqual(4);
    }
  });
});

describe("sequences", () => {
  it("always shows enough terms to pin down one rule", () => {
    const r = rng(31337);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 200; i++) {
        const q = generateQuestion("sequence", r, level, `s-${i}`);
        // Five is the minimum at which "2 4 8 16" stops having two honest readings.
        const shown = q.prompt.split(",").length - 1;
        expect(shown, q.prompt).toBeGreaterThanOrEqual(5);
        expect(q.prompt).toContain("?");
      }
    }
  });

  it("only ever asks for whole numbers", () => {
    const r = rng(5);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 200; i++) {
        const q = generateQuestion("sequence", r, level, `s-${i}`);
        if (q.answer.type !== "numeric") continue;
        expect(Number.isInteger(q.answer.value), q.prompt).toBe(true);
      }
    }
  });
});

describe("probabilities", () => {
  it("stays inside [0, 1]", () => {
    const r = rng(2718);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 300; i++) {
        const q = generateQuestion("probability", r, level, `p-${i}`);
        if (q.answer.type !== "numeric") continue;
        expect(q.answer.value, q.prompt).toBeGreaterThanOrEqual(0);
        expect(q.answer.value, q.prompt).toBeLessThanOrEqual(1);
      }
    }
  });

  it("accepts a two-decimal rounding, because that is what people write", () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion("probability", r, 3, `p-${i}`);
      if (q.answer.type !== "numeric") continue;
      expect(isCorrect(q.answer, q.answer.value.toFixed(2)), q.prompt).toBe(true);
    }
  });

  it("accepts the fraction as readily as the decimal", () => {
    // 5/36 and 0.139 are the same answer; a grader that takes only one of them is broken.
    expect(isCorrect({ type: "numeric", value: 5 / 36, tolerance: 0.005 }, "5/36")).toBe(true);
    expect(isCorrect({ type: "numeric", value: 5 / 36, tolerance: 0.005 }, "0.139")).toBe(true);
    expect(isCorrect({ type: "numeric", value: 5 / 36, tolerance: 0.005 }, "1/36")).toBe(false);
  });
});

describe("determinism", () => {
  it("gives the same paper for the same seed", () => {
    const one = Array.from({ length: 50 }, (_, i) => generateQuestion("arithmetic", rng(7), 3, `a-${i}`));
    const two = Array.from({ length: 50 }, (_, i) => generateQuestion("arithmetic", rng(7), 3, `a-${i}`));
    expect(one.map((q) => q.prompt)).toEqual(two.map((q) => q.prompt));
  });

  it("gives a different paper for a different seed", () => {
    const r1 = rng(1);
    const r2 = rng(2);
    const a = Array.from({ length: 30 }, (_, i) => generateQuestion("arithmetic", r1, 3, `a-${i}`).prompt);
    const b = Array.from({ length: 30 }, (_, i) => generateQuestion("arithmetic", r2, 3, `a-${i}`).prompt);
    expect(a).not.toEqual(b);
  });
});

describe("the tolerance boundary", () => {
  // 3/8 rounds to 0.38, which is exactly 0.005 away — and 0.38 - 0.375 is 0.0050000000000000044
  // in binary. A bare `<=` marks a correctly rounded answer wrong.
  it("accepts an answer sitting exactly on the tolerance", () => {
    expect(isCorrect({ type: "numeric", value: 0.375, tolerance: 0.005 }, "0.38")).toBe(true);
    expect(isCorrect({ type: "numeric", value: 0.375, tolerance: 0.005 }, "0.37")).toBe(true);
  });

  it("still rejects an answer past it", () => {
    expect(isCorrect({ type: "numeric", value: 0.375, tolerance: 0.005 }, "0.39")).toBe(false);
    expect(isCorrect({ type: "numeric", value: 0.375, tolerance: 0.005 }, "0.36")).toBe(false);
  });

  it("keeps exact answers exact", () => {
    expect(isCorrect({ type: "numeric", value: 42 }, "42")).toBe(true);
    expect(isCorrect({ type: "numeric", value: 42 }, "42.0001")).toBe(false);
  });
});
