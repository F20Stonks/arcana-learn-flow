/**
 * The Leibniz lesson's arithmetic, checked numerically.
 *
 * Every other lesson in this curriculum is checked automatically by lessonExamples.test.ts, which
 * differentiates or integrates each example's `integrandExpr` against its `resultExpr`. This lesson
 * cannot use that machinery: its claims are of the form "d/dt of this integral, at this t, equals
 * this number", which is not the shape "this integral equals that value". Leaving it as the one
 * lesson in the course with no machine-checked arithmetic was not acceptable — so this file checks
 * the same claims by the only method that actually applies: compute F(t) by quadrature, then
 * differentiate THAT numerically, and compare against the value the lesson states.
 *
 * Nothing here reuses the lesson's own algebra. The integrals are re-encoded from the lesson's
 * stated F(t) definitions and the expected values are typed as independent literals, so an error
 * in the lesson's reasoning cannot hide by being replicated in the check.
 *
 * The known limitation, stated plainly: these claims are transcribed, not read out of the module,
 * so a future edit that changes a lesson example without changing this file would not be caught.
 * That is the same trade lessonExamples.test.ts makes when it duplicates derivative()/quadrature()
 * rather than importing them. What this file does guarantee is that the mathematics currently
 * written in the lesson is right.
 */
import { describe, expect, it } from "vitest";
import { LeibnizRule } from "./leibnizRule";

/** Composite Simpson on a finite interval — plenty for these smooth integrands. */
function simpson(f: (x: number) => number, a: number, b: number, n = 20000): number {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

/** Five-point central difference — the same scheme problems.test.ts uses on antiderivatives. */
function ddt(F: (t: number) => number, t: number, h = 1e-4): number {
  return (F(t - 2 * h) - 8 * F(t - h) + 8 * F(t + h) - F(t + 2 * h)) / (12 * h);
}

interface Claim {
  what: string;
  F: (t: number) => number;
  at: number;
  /** The value the lesson states, typed independently rather than computed from its formula. */
  stated: number;
}

const CLAIMS: Claim[] = [
  {
    what: "examples[0]: F(t) = ∫_t^{t²} e^{-x²} dx, F'(1) = 1/e",
    F: (t) => simpson((x) => Math.exp(-x * x), t, t * t),
    at: 1,
    stated: 1 / Math.E,
  },
  {
    what: "examples[1]: F(t) = ∫_t^{2t} x^t dx, F'(1) = 2ln2 + 9/4",
    F: (t) => simpson((x) => Math.pow(x, t), t, 2 * t),
    at: 1,
    stated: 2 * Math.log(2) + 9 / 4,
  },
  {
    what: "completions[0]: F(t) = ∫_t^{t³} (x/t) dx, F'(1) = 2",
    F: (t) => simpson((x) => x / t, t, t * t * t),
    at: 1,
    stated: 2,
  },
  {
    what: "completions[1]: F(t) = ∫_t^4 x^{-2} dx, F'(2) = -1/4",
    F: (t) => simpson((x) => 1 / (x * x), t, 4),
    at: 2,
    stated: -0.25,
  },
];

describe("the general Leibniz rule lesson", () => {
  it("is the technique it says it is", () => {
    expect(LeibnizRule.id).toBe("leibniz-rule");
    // The legacy singular field must BE examples[0], never a second copy that can drift.
    expect(LeibnizRule.example).toBe(LeibnizRule.examples?.[0]);
  });

  it("states as many worked examples and completions as this file checks", () => {
    // A guard, so adding an example without adding a check fails loudly rather than silently
    // shipping unverified arithmetic — the one thing this lesson has no automatic net for.
    const examples = LeibnizRule.examples?.length ?? 0;
    const completions = LeibnizRule.completions?.length ?? 0;
    expect(examples + completions).toBe(CLAIMS.length);
  });

  it.each(CLAIMS.map((c) => [c.what, c] as const))("%s", (_what, claim) => {
    const numeric = ddt(claim.F, claim.at);
    const tol = 1e-5 * (1 + Math.abs(claim.stated));
    expect(Math.abs(numeric - claim.stated)).toBeLessThan(tol);
  });
});
