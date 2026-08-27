/**
 * Shared numeric verification, mirrored EXACTLY from
 * src/features/integrals/problems.test.ts (derivative / quadrature / fn) plus the mathjs
 * normalize() step from src/features/integrals/answer.ts.
 *
 * Kept as a hand-copy rather than an import so this script never depends on a TS runtime —
 * it's plain Node + mathjs (already a project dependency). If problems.test.ts's tolerances or
 * quadrature scheme ever change, mirror the change here too.
 */
import { parse } from "mathjs";

// --- normalize(), trimmed to what candidate integrandExpr/answer strings actually need ---
// Candidates should already be written in mathjs-ready syntax (see schema.md), but we run the
// real normalize() from answer.ts when available so LaTeX-ish input still verifies.
export function fn(expr, normalizeFn) {
  const src = normalizeFn ? normalizeFn(expr) : expr;
  const compiled = parse(src).compile();
  return (x) => {
    try {
      const v = compiled.evaluate(x === undefined ? {} : { x });
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
}

export function derivative(f, x, h) {
  const [a, b, c, d] = [f(x - 2 * h), f(x - h), f(x + h), f(x + 2 * h)];
  if (a === null || b === null || c === null || d === null) return null;
  return (a - 8 * b + 8 * c - d) / (12 * h);
}

export function quadrature(f, a, b, n = 4000) {
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

/** Verifies one candidate exactly the way problems.test.ts verifies a shipped Problem. */
export function verifyCandidate(p, normalizeFn) {
  const errors = [];
  const [a, b] = p.domain;

  if (p.kind === "indefinite") {
    const F = fn(p.answer, normalizeFn);
    const f = fn(p.integrandExpr, normalizeFn);
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
      if (Math.abs(dF - target) >= tol) {
        errors.push(`at x=${x.toFixed(3)}: d/dx(answer)=${dF} but integrand=${target} (tol ${tol})`);
      }
    }
    if (checked < 7) errors.push(`only ${checked}/9 sample points were evaluable on its own domain`);
  } else {
    if (!p.lower || !p.upper) errors.push("definite problem is missing lower/upper");
    const f = fn(p.integrandExpr, normalizeFn);
    const numeric = quadrature(f, a, b);
    let expected;
    try {
      expected = parse(normalizeFn ? normalizeFn(p.answer) : p.answer).compile().evaluate({});
    } catch (e) {
      errors.push(`answer failed to evaluate: ${e.message}`);
      return errors;
    }
    const tol = 1e-4 * (1 + Math.abs(expected));
    if (Math.abs(numeric - expected) >= tol) {
      errors.push(`quadrature gave ${numeric}, stored answer evaluates to ${expected} (tol ${tol})`);
    }
  }
  return errors;
}
