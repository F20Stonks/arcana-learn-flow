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

const KINDS: QuestionKind[] = [
  "arithmetic",
  "sequence",
  "probability",
  "expected-value",
  "market-making",
  "options",
  "estimation",
  "logic",
  "zap",
];
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

describe("estimation bands", () => {
  it("always contains the true value, and is the stated ±10%", () => {
    const r = rng(808);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 200; i++) {
        const q = generateQuestion("estimation", r, level, `e-${i}`);
        expect(q.answer.type).toBe("range");
        if (q.answer.type !== "range") continue;
        const mid = (q.answer.low + q.answer.high) / 2;
        expect(q.answer.low).toBeGreaterThan(0);
        // The band is ±10% of the true value, so its half-width is a tenth of its centre.
        expect((q.answer.high - q.answer.low) / 2).toBeCloseTo(mid * 0.1, 6);
        expect(isCorrect(q.answer, String(mid))).toBe(true);
      }
    }
  });

  it("rejects an answer well outside the band", () => {
    const r = rng(9);
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion("estimation", r, 3, `e-${i}`);
      if (q.answer.type !== "range") continue;
      const mid = (q.answer.low + q.answer.high) / 2;
      expect(isCorrect(q.answer, String(mid * 1.25)), q.prompt).toBe(false);
      expect(isCorrect(q.answer, String(mid * 0.75)), q.prompt).toBe(false);
    }
  });
});

describe("logic", () => {
  it("puts the right name among the options on an ordering question", () => {
    const r = rng(77);
    let seen = 0;
    for (let i = 0; i < 600; i++) {
      const q = generateQuestion("logic", r, 4, `l-${i}`);
      if (q.answer.type !== "choice") continue;
      seen++;
      expect(q.choices).toHaveLength(4);
      expect(q.answer.index, q.prompt).toBeGreaterThanOrEqual(0);
      // The stated order in the explanation must name the option the answer points at.
      const order = /order from tallest is (.+?),/.exec(q.explanation)![1].split(" > ");
      expect(order).toContain(q.choices![q.answer.index]);
    }
    expect(seen, "no ordering questions were generated at all").toBeGreaterThan(0);
  });

  it("never asks for an overlap that cannot exist", () => {
    // Solving backwards from two set totals can produce a negative intersection; this is built
    // forwards from the disjoint regions so it cannot.
    const r = rng(1234);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 400; i++) {
        const q = generateQuestion("logic", r, level, `v-${i}`);
        const m = /Of (\d+) people, (\d+) play chess and (\d+) play go\. (\d+) play neither/.exec(
          q.prompt,
        );
        if (!m) continue;
        const [total, a, b, neither] = m.slice(1).map(Number);
        if (q.answer.type !== "numeric") continue;
        const both = q.answer.value;
        expect(both, q.prompt).toBeGreaterThanOrEqual(0);
        expect(both, q.prompt).toBeLessThanOrEqual(Math.min(a, b));
        // Inclusion-exclusion has to close.
        expect(a + b - both + neither, q.prompt).toBe(total);
      }
    }
  });
});

describe("market making", () => {
  it("answers a fill with a signed position of exactly the quoted size", () => {
    const r = rng(50);
    for (let i = 0; i < 800; i++) {
      const q = generateQuestion("market-making", r, 3, `m-${i}`);
      const m = /(\d+) up\. A counterparty (hits your bid|lifts your offer)/.exec(q.prompt);
      if (!m || q.answer.type !== "numeric") continue;
      const size = Number(m[1]);
      // Hit on the bid means they sold to you: long. Lifted means they bought: short.
      expect(q.answer.value, q.prompt).toBe(m[2] === "hits your bid" ? size : -size);
    }
  });

  it("never quotes a negative width", () => {
    const r = rng(51);
    for (let i = 0; i < 500; i++) {
      const q = generateQuestion("market-making", r, 2, `w-${i}`);
      if (!q.prompt.includes("How wide")) continue;
      if (q.answer.type !== "numeric") continue;
      expect(q.answer.value, q.prompt).toBeGreaterThan(0);
    }
  });
});

describe("options", () => {
  it("never prices a plain expiring option below zero", () => {
    const r = rng(60);
    for (let i = 0; i < 800; i++) {
      const q = generateQuestion("options", r, 2, `o-${i}`);
      if (!/expires with the underlying at/.test(q.prompt)) continue;
      if (q.answer.type !== "numeric") continue;
      expect(q.answer.value, q.prompt).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps put-call parity self-consistent", () => {
    const r = rng(61);
    for (let i = 0; i < 900; i++) {
      const q = generateQuestion("options", r, 4, `pc-${i}`);
      const call = /underlying is at (\d+) and the (\d+)-strike call is worth (\d+)/.exec(q.prompt);
      const put = /underlying is at (\d+) and the (\d+)-strike put is worth (\d+)/.exec(q.prompt);
      if (q.answer.type !== "numeric") continue;
      // C - P = S - K, so whichever leg is asked for must satisfy it against the one given.
      if (call) {
        const [s, k, c] = call.slice(1).map(Number);
        expect(c - q.answer.value, q.prompt).toBe(s - k);
      } else if (put) {
        const [s, k, p] = put.slice(1).map(Number);
        expect(q.answer.value - p, q.prompt).toBe(s - k);
      }
    }
  });
});

describe("zap", () => {
  it("answers the grid it actually shows", () => {
    const r = rng(70);
    let checked = 0;
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 300; i++) {
        const q = generateQuestion("zap", r, level, `z-${i}`);
        const body = /\\begin\{array\}\{r+\}(.*?)\\end\{array\}/.exec(q.prompt)![1];
        const values = body
          .split("\\\\")
          .flatMap((row) => row.split("&").map((c) => Number(c.trim())));
        expect(values, q.prompt).toHaveLength(20);
        expect(values.every(Number.isFinite)).toBe(true);
        if (q.answer.type !== "numeric") continue;

        // Recompute the two questions whose answer is fully determined by the grid.
        const sum = /sum of row (\d+)/.exec(q.prompt);
        if (sum) {
          const row = Number(sum[1]) - 1;
          const expected = values.slice(row * 5, row * 5 + 5).reduce((a, b) => a + b, 0);
          expect(q.answer.value, q.prompt).toBe(expected);
          checked++;
        }
        const above = /greater than (\d+)/.exec(q.prompt);
        if (above) {
          const t = Number(above[1]);
          expect(q.answer.value, q.prompt).toBe(values.filter((v) => v > t).length);
          checked++;
        }
        const pairs = /pairs of cells add up to (\d+)/.exec(q.prompt);
        if (pairs) {
          const t = Number(pairs[1]);
          let n = 0;
          for (let x = 0; x < values.length; x++) {
            for (let y = x + 1; y < values.length; y++) if (values[x] + values[y] === t) n++;
          }
          expect(q.answer.value, q.prompt).toBe(n);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
