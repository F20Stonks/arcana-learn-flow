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
import { PROBLEMS, problemsForSource, SOURCES, sourceKey } from "./problems";
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
 *
 * Infinite bounds get an extra change of variable first, mapping the unbounded tail onto (0,1) or
 * (-1,1) before the same smoothstep-midpoint scheme runs on that finite interval:
 *   (0, ∞):    x = a + t/(1-t),        t ∈ (0,1)
 *   (-∞, ∞):   x = t/(1-t²),           t ∈ (-1,1)
 * Both are ordinary algebraic substitutions (no exp/log involved), so they stay well-conditioned
 * even where x itself grows huge. This only converges cleanly for tails that decay at least
 * exponentially; a slower (e.g. logarithmic) tail needs a problem-specific closed form instead —
 * see the reciprocal-substitution technique's lesson example.
 */
function quadrature(f: (x: number) => number | null, a: number, b: number, n = 4000): number {
  if (a === -Infinity && b === Infinity) {
    return quadrature((t) => {
      const x = t / (1 - t * t);
      const v = f(x);
      return v === null ? null : v * ((1 + t * t) / (1 - t * t) ** 2);
    }, -1, 1, n);
  }
  if (b === Infinity) {
    return quadrature((t) => {
      const x = a + t / (1 - t);
      const v = f(x);
      return v === null ? null : v / (1 - t) ** 2;
    }, 0, 1, n);
  }
  if (a === -Infinity) {
    return quadrature((t) => {
      const x = b - t / (1 - t);
      const v = f(x);
      return v === null ? null : v / (1 - t) ** 2;
    }, 0, 1, n);
  }
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

  /**
   * The daily draws from one difficulty pool per weekday and walks a shuffle of it, so the pool
   * size *is* the number of weeks before that weekday comes round again. Twenty is the floor.
   */
  it("keeps every daily pool deep enough to last five months", () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      const pool = PROBLEMS.filter((p) => p.difficulty === d);
      expect(pool.length, `difficulty ${d} pool is only ${pool.length} deep`).toBeGreaterThanOrEqual(20);
    }
  });

  it("gives every technique enough problems for a practice session", () => {
    for (const t of TECHNIQUES) {
      const pool = PROBLEMS.filter((p) => p.techniques.includes(t.id));
      expect(pool.length, t.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("has no duplicated integrands", () => {
    const seen = new Map<string, string>();
    for (const p of PROBLEMS) {
      const key = `${p.kind}:${p.integrandExpr.replace(/\s+/g, "")}:${p.lower ?? ""}:${p.upper ?? ""}`;
      const prior = seen.get(key);
      expect(prior, `${p.id} duplicates ${prior}`).toBeUndefined();
      seen.set(key, p.id);
    }
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

  it("gives every problem a source", () => {
    for (const p of PROBLEMS) {
      expect(p.source?.name, p.id).toBeTruthy();
    }
  });

  it("finds every problem again through problemsForSource", () => {
    // Every problem must show up under its own source key, and SOURCES must list that key once.
    const bySource = new Map<string, number>();
    for (const p of PROBLEMS) {
      const key = sourceKey(p.source);
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    expect(new Set(SOURCES.map(sourceKey)).size).toBe(SOURCES.length);
    for (const s of SOURCES) {
      expect(problemsForSource(s).length, sourceKey(s)).toBe(bySource.get(sourceKey(s)));
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
