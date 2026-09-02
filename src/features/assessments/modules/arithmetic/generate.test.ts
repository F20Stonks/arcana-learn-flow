import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs";
import { seededRng } from "../../engine/rng";
import { parseNumericAnswer } from "../../engine/check";
import { generateArithmeticItem } from "./generate";
import { ARITHMETIC_PROFILES } from "./profiles";

/**
 * The bank grades itself.
 *
 * Same discipline as src/features/integrals/problems.test.ts, which differentiates every stored
 * antiderivative and compares it back to the integrand: nothing here trusts the generator's own
 * arithmetic. Each generated prompt is parsed back out of its rendered string and evaluated
 * independently — by mathjs where it is an ordinary expression, by hand where it is not — and the
 * stored answer has to match.
 *
 * That catches the bug class that would do the most damage: `3.4 + 12.7` is 16.099999999999998 in
 * floating point, and an assessment that marks a correct "16.1" wrong is worse than no assessment.
 */

/** Re-parses a rendered prompt and computes its value without reusing generator code. */
function evaluatePrompt(prompt: string): number {
  const percent = /^(\d+)% of (\d+)$/.exec(prompt);
  if (percent) return (Number(percent[1]) * Number(percent[2])) / 100;

  const mulMissing = /^(\d+) × \? = (\d+)$/.exec(prompt);
  if (mulMissing) return Number(mulMissing[2]) / Number(mulMissing[1]);

  const addMissing = /^\? \+ (\d+) = (\d+)$/.exec(prompt);
  if (addMissing) return Number(addMissing[2]) - Number(addMissing[1]);

  const fraction = /^\$\\frac\{(\d+)\}\{(\d+)\} ([+-]) \\frac\{(\d+)\}\{(\d+)\}\$$/.exec(prompt);
  if (fraction) {
    const [, n1, d1, op, n2, d2] = fraction;
    const left = Number(n1) / Number(d1);
    const right = Number(n2) / Number(d2);
    return op === "+" ? left + right : left - right;
  }

  return evaluate(prompt.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")) as number;
}

const PROFILES = Object.values(ARITHMETIC_PROFILES);

describe("speed-arithmetic generator", () => {
  for (const profile of PROFILES) {
    describe(profile.id, () => {
      // 40 seeds x 80 items is a whole paper forty times over — enough that a one-in-a-thousand
      // branch cannot hide.
      const items = Array.from({ length: 40 }, (_, seed) => {
        const rng = seededRng(seed + 1);
        return Array.from({ length: 80 }, (_, index) => generateArithmeticItem(rng, index, { profile }));
      }).flat();

      it("generates a stored answer that matches an independent evaluation of the prompt", () => {
        for (const item of items) {
          const expected = evaluatePrompt(item.prompt);
          const stored = parseNumericAnswer(item.answer);
          expect(stored, `unparseable answer "${item.answer}" for "${item.prompt}"`).not.toBeNull();
          expect(
            Math.abs((stored as number) - expected),
            `${item.prompt} → stored ${item.answer}, evaluated ${expected}`,
          ).toBeLessThan(1e-9);
        }
      });

      it("never stores a floating-point artifact", () => {
        // The failure mode this exists for: "16.099999999999998" or "0.30000000000000004".
        for (const item of items) {
          expect(item.answer, `artifact in "${item.answer}" for "${item.prompt}"`).not.toMatch(
            /\d(0000|9999)\d*$/,
          );
        }
      });

      it("keeps division exact", () => {
        for (const item of items.filter((i) => i.tag === "div_exact")) {
          expect(Number.isInteger(Number(item.answer)), `${item.prompt} → ${item.answer}`).toBe(true);
        }
      });

      it("reduces fractions and never divides by zero", () => {
        for (const item of items.filter((i) => i.tag === "fraction_addsub")) {
          const parts = item.answer.split("/");
          if (parts.length !== 2) continue;
          const [n, d] = parts.map(Number);
          expect(d, `zero denominator in ${item.answer}`).not.toBe(0);
          const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
          expect(gcd(n, d), `${item.answer} is not in lowest terms`).toBe(1);
        }
      });

      it("tags every item with an operation the profile actually enables", () => {
        const enabled = new Set(
          Object.entries(profile.weights).filter(([, w]) => w > 0).map(([op]) => op),
        );
        for (const item of items) {
          expect(enabled.has(item.tag), `${item.tag} is switched off in ${profile.id}`).toBe(true);
        }
      });

      it("is deterministic — the same seed produces the same paper", () => {
        const paper = (seed: number) => {
          const rng = seededRng(seed);
          return Array.from({ length: 30 }, (_, i) => generateArithmeticItem(rng, i, { profile }));
        };
        expect(paper(12345).map((i) => i.prompt)).toEqual(paper(12345).map((i) => i.prompt));
      });

      it("does not ask the same question twice in a row", () => {
        const rng = seededRng(99);
        const prompts = Array.from({ length: 200 }, (_, i) => generateArithmeticItem(rng, i, { profile }).prompt);
        for (let i = 1; i < prompts.length; i++) {
          expect(prompts[i], `repeated at index ${i}`).not.toBe(prompts[i - 1]);
        }
      });
    });
  }
});
