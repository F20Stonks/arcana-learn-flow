/**
 * A mathjs instance extended with the Lambert W function (principal branch, W0), which mathjs
 * doesn't ship. Needed to self-check the Integral of Inverse technique's Lambert W problem — the
 * bank verifies itself by numerically integrating `integrandExpr`, so lambertw(x) has to actually
 * evaluate, not just render as LaTeX. Both the grader (answer.ts) and the bank's self-check
 * (problems.test.ts) parse through this instance so it evaluates the same way everywhere.
 */
import { create, all } from "mathjs";

export const mathInstance = create(all);

/** Halley's method; valid on the principal branch's domain x ≥ -1/e. */
function lambertw(x: number): number {
  if (!Number.isFinite(x) || x < -1 / Math.E) return NaN;
  if (x === 0) return 0;
  let w = x < 1 ? x : Math.log(x);
  for (let i = 0; i < 100; i++) {
    const ew = Math.exp(w);
    const f = w * ew - x;
    const wp1 = w + 1;
    const denom = ew * wp1 - ((w + 2) * f) / (2 * wp1);
    if (denom === 0) break;
    const dw = f / denom;
    w -= dw;
    if (Math.abs(dw) < 1e-14) break;
  }
  return w;
}

mathInstance.import({ lambertw }, { override: false });

export const parse = mathInstance.parse;
