/**
 * Number formatting for probability-module option labels.
 *
 * Every template answer is a plain JS number computed by ordinary double arithmetic — that's safe
 * here because `choice` items are graded by comparing the submitted *option id*, never by
 * re-parsing the label (see engine/check.ts: `if (item.choices) return raw === item.answer`). So
 * the only job of this file is cosmetic: never show a candidate a floating-point artifact like
 * "0.16666666666666666". Where the value is a clean rational (nearly everything here, since every
 * template is built from integer or simple-rational parameters) we show a reduced fraction;
 * otherwise a short, trimmed decimal.
 */

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/**
 * Best rational approximation of `x` via continued-fraction convergents, capped at `maxDen`. Fast
 * (a few dozen iterations at most) and exact whenever `x` really is p/q with q <= maxDen, which
 * covers every closed form in this module.
 */
function toFraction(x: number, maxDen: number, tol: number): { num: number; den: number } | null {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let h0 = 0;
  let h1 = 1;
  let k0 = 1;
  let k1 = 0;
  let b = ax;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    if (k1 > 0 && Math.abs(ax - h1 / k1) < tol) break;
    const frac = b - a;
    if (frac < 1e-12) break;
    b = 1 / frac;
  }
  if (k1 === 0) return null;
  if (Math.abs(ax - h1 / k1) > 1e-7) return null;
  return { num: sign * h1, den: k1 };
}

/** Formats a probability, expectation, or count as a clean human-readable label. */
export function formatValue(raw: number): string {
  const v = Object.is(raw, -0) ? 0 : raw;
  const rounded = Math.round(v);
  if (Math.abs(v - rounded) < 1e-9) return String(rounded);

  const frac = toFraction(v, 100_000, 1e-9);
  if (frac) {
    const g = gcd(frac.num, frac.den);
    const num = frac.num / g;
    const den = frac.den / g;
    if (den <= 10_000 && den !== 1) return `${num}/${den}`;
  }

  // Fallback: 4 significant figures, trimmed, no scientific notation for the magnitudes we use.
  const p = Number(v.toPrecision(4));
  return String(p);
}

/**
 * Formats a whole option set to ONE consistent shape.
 *
 * Formatting each option independently leaks the answer. A variance item whose options are
 * 105/4, 945/4, 273/2 and an irrational standard-deviation distractor renders that last one as
 * "5.123" — and a candidate who has done no arithmetic at all can see which option is not like the
 * others. Whenever any value in the set needs a decimal, every value in the set gets one.
 */
export function formatValueSet(values: number[]): string[] {
  const allExact = values.every((v) => !formatValue(v).includes("."));
  if (allExact) return values.map(formatValue);
  return values.map((v) => String(Number(v.toPrecision(4))));
}

/** Numeric equality for de-duplicating distractors, independent of display formatting. */
export function nearlyEqual(a: number, b: number, tol = 1e-7): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
