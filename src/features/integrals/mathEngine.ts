/**
 * A mathjs instance extended with functions mathjs doesn't ship (currently just `lambertw`),
 * shared by both the live grading path (`answer.ts`) and the self-verifying test suite
 * (`problems.test.ts`) so a problem using one of these functions behaves identically in both.
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

math.import({ lambertw }, { override: false });

export const parse = math.parse;
