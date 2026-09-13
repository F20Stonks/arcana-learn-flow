/**
 * A mathjs instance extended with functions mathjs doesn't ship natively (`lambertw`, `beta`,
 * `digamma` — mathjs already has `gamma` and `zeta` built in), shared by both the live grading
 * path (`answer.ts`) and the self-verifying test suite (`problems.test.ts`/
 * `lessonExamples.test.ts`) so a problem using one of these functions behaves identically
 * everywhere.
 *
 * These exist for one specific reason: a student who correctly reduces an integral to `zeta(2)`
 * or `digamma(5)` should never be marked wrong just because they didn't also know (or bother
 * typing) the closed form. `checkDefinite`/`checkIndefinite` grade by numeric evaluation, so once
 * a function is registered here, any expression built from it grades exactly like the elementary
 * closed form it's numerically equal to — no reference answer needs to change.
 */
import { create, all } from "mathjs";

const math = create(all);

/** Principal branch W_0(x), valid for x > -1/e (the only branch this bank's problems need). */
function lambertw(x: number): number {
  if (x === 0) return 0;
  const invE = -1 / Math.E;
  if (x < invE) return NaN;
  // Near the branch point the standard Newton step is ill-conditioned; a square-root expansion
  // gets close enough for Halley's method (below) to finish the job.
  let w: number;
  if (x < invE + 1e-4) {
    const p = Math.sqrt(2 * (Math.E * x + 1));
    w = -1 + p - p ** 2 / 3;
  } else if (x < 3) {
    w = x / (1 + x);
  } else {
    w = Math.log(x) - Math.log(Math.log(x));
  }
  for (let i = 0; i < 100; i++) {
    const ew = Math.exp(w);
    const wew = w * ew;
    const f = wew - x;
    const wp1 = w + 1;
    const denom = ew * wp1 - ((w + 2) * f) / (2 * wp1);
    const next = w - f / denom;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - w) < 1e-15) {
      w = next;
      break;
    }
    w = next;
  }
  return w;
}

/**
 * Euler beta function, B(a,b) = Γ(a)Γ(b)/Γ(a+b) — built straight from mathjs's own `gamma`.
 * (mathjs ships `zeta` and `gamma` natively — no custom implementation needed for those.)
 */
function beta(a: number, b: number): number {
  return (math.gamma(a) as number) * (math.gamma(b) as number) / (math.gamma(a + b) as number);
}

/**
 * Digamma (psi) function, real argument: ψ(x) = d/dx ln Γ(x). Uses the recurrence
 * ψ(x) = ψ(x+1) - 1/x to push the argument up past 6 (where the asymptotic series below is
 * accurate to double precision), the same shift-then-expand approach a real implementation of
 * gamma/lgamma itself would use.
 */
function digamma(x: number): number {
  let v = x;
  let shift = 0;
  while (v < 6) {
    shift -= 1 / v;
    v += 1;
  }
  const inv = 1 / v;
  const inv2 = inv * inv;
  // Asymptotic series ψ(v) ~ ln(v) - 1/(2v) - sum Bernoulli terms.
  const series =
    Math.log(v) -
    0.5 * inv -
    inv2 * (1 / 12 - inv2 * (1 / 120 - inv2 * (1 / 252 - inv2 * (1 / 240 - (inv2 * 1) / 132))));
  return shift + series;
}

math.import({ lambertw, beta, digamma }, { override: false });

export const parse = math.parse;
