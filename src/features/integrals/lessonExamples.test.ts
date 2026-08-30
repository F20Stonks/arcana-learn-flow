/**
 * The lesson curriculum grades itself too.
 *
 * problems.test.ts differentiates every stored Problem answer and checks it against the integrand
 * (indefinite), or numerically integrates and checks it against the stored value (definite) — the
 * safety net that makes a bad answer fail a test instead of failing a student. UK_BEE_BURST.md's
 * WS-2 guardrail asks for the same net under the lesson content: "every worked example ... must be
 * verified numerically before it ships ... where a lesson's example evaluates an integral, add it
 * as a test fixture so it *is* checked." This file is that fixture — same method, same tolerances,
 * applied to every WorkedExample that carries a machine-checkable integrandExpr/resultExpr/domain
 * (see WorkedExample in types.ts). An example authored without those fields — a derivation of an
 * identity, a qualitative aside — is simply not in the `gradeable` set below and isn't claimed to be
 * checked; everything that IS in it is checked exactly like a bank problem.
 */
import { describe, expect, it } from "vitest";
import katex from "katex";
import { parse } from "./mathEngine";
import { normalize } from "./answer";
import { toMathMode } from "./mathText";
import { TECHNIQUES } from "./techniques";
import type { Completion, WorkedExample } from "./types";

// strict:"error" turns KaTeX's warnings (stray unicode, bad spacing) into failures too — identical
// to mathText.test.ts's own `renders` helper, duplicated here rather than imported so importing
// this file can never accidentally re-register mathText.test.ts's own describe/it blocks.
const renders = (s: string) => {
  katex.renderToString(toMathMode(s), { throwOnError: true, strict: "error", displayMode: false });
  return true;
};

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

/** Five-point central difference — copied verbatim from problems.test.ts's derivative(). */
function derivative(f: (x: number) => number | null, x: number, h: number): number | null {
  const [a, b, c, d] = [f(x - 2 * h), f(x - h), f(x + h), f(x + 2 * h)];
  if (a === null || b === null || c === null || d === null) return null;
  return (a - 8 * b + 8 * c - d) / (12 * h);
}

/** Smoothstep-substitution midpoint quadrature, infinite-bound-capable — copied verbatim from
 *  problems.test.ts's quadrature(). See that file for the full derivation/rationale comment. */
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

describe("lesson prose renders", () => {
  it.each(TECHNIQUES.map((t) => [t.id, t] as const))("%s", (_id, t) => {
    expect(renders(t.whenToUse)).toBe(true);
    if (t.intuition) expect(renders(t.intuition)).toBe(true);
    if (t.prerequisites) for (const p of t.prerequisites) expect(renders(p)).toBe(true);
    for (const r of t.recipe) expect(renders(r)).toBe(true);
    for (const p of t.pitfalls) expect(renders(p)).toBe(true);

    const examples = t.examples ?? [t.example];
    expect(examples.length).toBeGreaterThan(0);
    for (const ex of examples) {
      expect(renders(ex.integrand)).toBe(true);
      expect(renders(ex.result)).toBe(true);
      for (const w of ex.work) expect(renders(w)).toBe(true);
    }

    if (t.checkYourself) {
      expect(renders(t.checkYourself.prompt)).toBe(true);
      expect(renders(t.checkYourself.answer)).toBe(true);
      expect(renders(t.checkYourself.hint)).toBe(true);
    }

    for (const c of t.completions ?? []) {
      for (const s of c.setup) expect(renders(s)).toBe(true);
      expect(renders(c.blank)).toBe(true);
      expect(renders(c.answer)).toBe(true);
    }

    if (t.selfExplain) {
      expect(renders(t.selfExplain.prompt)).toBe(true);
      expect(renders(t.selfExplain.answer)).toBe(true);
    }
  });
});

interface Gradeable {
  label: string;
  ex: WorkedExample & Required<Pick<WorkedExample, "integrandExpr" | "resultExpr" | "domain" | "kind">>;
}

const gradeable: Gradeable[] = TECHNIQUES.flatMap((t) =>
  (t.examples ?? [t.example])
    .map((ex, i) => ({ label: `${t.id}#${i}`, ex }))
    .filter(
      (e): e is Gradeable =>
        e.ex.integrandExpr !== undefined &&
        e.ex.resultExpr !== undefined &&
        e.ex.domain !== undefined &&
        e.ex.kind !== undefined,
    ),
);

describe("lesson examples are actually correct", () => {
  it("has at least the examples this session's A-level-bridge rebuild added", () => {
    // Guards against a typo (a dropped field, a renamed key) silently emptying the whole gradeable
    // set — 20 is comfortably below the 26 examples across the 10 rebuilt techniques, so this fails
    // loudly rather than the describe.each below silently iterating zero cases.
    expect(gradeable.length).toBeGreaterThanOrEqual(20);
  });

  it.each(gradeable.map((g) => [g.label, g.ex] as const))("%s: the stated result is right", (_label, ex) => {
    const [a, b] = ex.domain;
    if (ex.kind === "indefinite") {
      const F = fn(ex.resultExpr);
      const f = fn(ex.integrandExpr);
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
        expect(Math.abs(dF - target), `at x=${x.toFixed(3)}`).toBeLessThan(tol);
      }
      expect(checked, "nothing was evaluable on this example's own domain").toBeGreaterThanOrEqual(7);
    } else {
      const f = fn(ex.integrandExpr);
      const numeric = quadrature(f, a, b);
      const expected = parse(normalize(ex.resultExpr)).compile().evaluate({}) as number;
      expect(Math.abs(numeric - expected), `quadrature gave ${numeric}`).toBeLessThan(
        1e-4 * (1 + Math.abs(expected)),
      );
    }
  });
});

interface GradeableCompletion {
  label: string;
  c: Completion & Required<Pick<Completion, "integrandExpr" | "resultExpr" | "domain" | "kind">>;
}

// Same gate as `gradeable` above, over Technique.completions instead of .examples — see Completion's
// doc comment in types.ts: a completion carries the mirror fields exactly when `setup` + `blank` +
// `answer` together state a literal evaluatable integral, which is true for nearly every one WS-10
// wrote (the exception would be a completion whose gap is a qualitative or algebraic-identity step
// rather than a final closed form — none exist yet, so this set is expected to track completions.ts
// one-to-one for now).
const gradeableCompletions: GradeableCompletion[] = TECHNIQUES.flatMap((t) =>
  (t.completions ?? [])
    .map((c, i) => ({ label: `${t.id}#${i}`, c }))
    .filter(
      (g): g is GradeableCompletion =>
        g.c.integrandExpr !== undefined &&
        g.c.resultExpr !== undefined &&
        g.c.domain !== undefined &&
        g.c.kind !== undefined,
    ),
);

describe("completion problems are actually correct", () => {
  it("has at least the completions WS-10 added", () => {
    // Same purpose as the `gradeable` guard above: fails loudly on a dropped field rather than
    // letting the describe.each below silently iterate zero cases.
    expect(gradeableCompletions.length).toBeGreaterThanOrEqual(20);
  });

  it.each(gradeableCompletions.map((g) => [g.label, g.c] as const))(
    "%s: the completed answer is right",
    (_label, c) => {
      const [a, b] = c.domain;
      if (c.kind === "indefinite") {
        const F = fn(c.resultExpr);
        const f = fn(c.integrandExpr);
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
          expect(Math.abs(dF - target), `at x=${x.toFixed(3)}`).toBeLessThan(tol);
        }
        expect(checked, "nothing was evaluable on this completion's own domain").toBeGreaterThanOrEqual(7);
      } else {
        const f = fn(c.integrandExpr);
        const numeric = quadrature(f, a, b);
        const expected = parse(normalize(c.resultExpr)).compile().evaluate({}) as number;
        expect(Math.abs(numeric - expected), `quadrature gave ${numeric}`).toBeLessThan(
          1e-4 * (1 + Math.abs(expected)),
        );
      }
    },
  );
});
