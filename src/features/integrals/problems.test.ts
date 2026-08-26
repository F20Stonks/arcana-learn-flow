/**
 * The bank grades itself.
 *
 * For every indefinite problem we differentiate the stored answer numerically and compare it to
 * the stored integrand across the whole grading domain; for every definite problem we integrate
 * the integrand numerically and compare to the stored value. A mistyped answer fails here rather
 * than telling a student who is right that they're wrong.
 */
import { describe, expect, it } from "vitest";
import { parse } from "mathjs";
import { gradeAnswer, normalize } from "./answer";
import { PROBLEMS } from "./problems";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "./techniques";

function fn(expr: string): (x: number) => number | null {
  const compiled = parse(normalize(expr)).compile();
  return (x: number) => {
    try {
      const v = compiled.evaluate({ x });
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
}

/** Five-point central difference — error O(h^4), so 1e-9 accuracy at h = 1e-4. */
function derivative(f: (x: number) => number | null, x: number, h: number): number | null {
  const [a, b, c, d] = [f(x - 2 * h), f(x - h), f(x + h), f(x + 2 * h)];
  if (a === null || b === null || c === null || d === null) return null;
  return (a - 8 * b + 8 * c - d) / (12 * h);
}

/**
 * Midpoint rule under a smoothstep change of variable. The Jacobian 6t(1-t) vanishes at both ends,
 * which tames the integrable endpoint singularities (ln sin x at 0) that would otherwise need
 * thousands more points.
 */
function quadrature(f: (x: number) => number | null, a: number, b: number, n = 4000): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const s = t * t * (3 - 2 * t);
    const jac = 6 * t * (1 - t);
    const v = f(a + (b - a) * s);
    if (v === null) continue;
    total += v * jac;
  }
  return (total / n) * (b - a);
}

describe("problem bank", () => {
  it("has a decent spread of problems", () => {
    expect(PROBLEMS.length).toBeGreaterThanOrEqual(40);
  });

  it("uses unique ids", () => {
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every technique in the curriculum", () => {
    for (const t of TECHNIQUES) {
      const count = PROBLEMS.filter((p) => p.techniques.includes(t.id)).length;
      expect(count, `${t.id} has no problems`).toBeGreaterThan(0);
    }
  });

  it("only tags techniques that exist", () => {
    for (const p of PROBLEMS) {
      for (const t of p.techniques) expect(TECHNIQUE_BY_ID[t], `${p.id} → ${t}`).toBeTruthy();
    }
  });

  it("gives every problem hints and a worked solution", () => {
    for (const p of PROBLEMS) {
      expect(p.hints.length, p.id).toBeGreaterThan(0);
      expect(p.steps.length, p.id).toBeGreaterThan(0);
    }
  });

  it("gives every definite problem its bounds", () => {
    for (const p of PROBLEMS.filter((p) => p.kind === "definite")) {
      expect(p.lower, p.id).toBeTruthy();
      expect(p.upper, p.id).toBeTruthy();
    }
  });

  it("accepts its own reference answer", () => {
    for (const p of PROBLEMS) {
      expect(gradeAnswer(p, p.answer).status, `${p.id} rejected its own answer`).toBe("correct");
    }
  });
});

describe("stored answers are actually correct", () => {
  const indefinite = PROBLEMS.filter((p) => p.kind === "indefinite");

  it.each(indefinite.map((p) => [p.id, p] as const))(
    "%s: d/dx(answer) matches the integrand",
    (_id, p) => {
      const F = fn(p.answer);
      const f = fn(p.integrandExpr);
      const [a, b] = p.domain;
      const margin = (b - a) * 0.05;
      const h = Math.min(1e-4, (b - a) * 1e-4);

      let checked = 0;
      for (let i = 0; i < 9; i++) {
        const x = a + margin + ((b - a - 2 * margin) * (i + 0.5)) / 9;
        const dF = derivative(F, x, h);
        const target = f(x);
        if (dF === null || target === null) continue;
        checked++;
        const tol = 1e-5 * (1 + Math.abs(target));
        expect(Math.abs(dF - target), `${p.id} at x=${x.toFixed(3)}`).toBeLessThan(tol);
      }
      expect(checked, `${p.id}: nothing was evaluable on its own domain`).toBeGreaterThanOrEqual(7);
    },
  );

  const definite = PROBLEMS.filter((p) => p.kind === "definite");

  it.each(definite.map((p) => [p.id, p] as const))("%s: the stated value is right", (_id, p) => {
    const f = fn(p.integrandExpr);
    const [a, b] = p.domain;
    const numeric = quadrature(f, a, b);
    const expected = parse(normalize(p.answer)).compile().evaluate({}) as number;
    expect(Math.abs(numeric - expected), `${p.id}: quadrature gave ${numeric}`).toBeLessThan(
      1e-4 * (1 + Math.abs(expected)),
    );
  });
});
