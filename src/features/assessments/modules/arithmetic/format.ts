/**
 * Shared numeric formatting helpers.
 *
 * Split out of generate.ts so it and distractors.ts can both depend on these without a runtime
 * circular import between them (generate.ts calls into distractors.ts to build choice items;
 * distractors.ts needs the same integer-safe formatting generate.ts uses to build the correct
 * answer, so the formatting itself lives here, underneath both).
 */

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Formats a value held as an integer scaled by 10^places, without touching floating point. */
export function fromScaled(scaled: number, places: number): string {
  const sign = scaled < 0 ? "-" : "";
  const digits = String(Math.abs(scaled)).padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const frac = digits.slice(digits.length - places).replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

/** Reduces num/den to lowest terms with a positive denominator; "n" when it reduces to an integer. */
export function formatFraction(num: number, den: number): string {
  let n = num;
  let d = den;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  const rn = n / g;
  const rd = d / g;
  return rd === 1 ? String(rn) : `${rn}/${rd}`;
}
