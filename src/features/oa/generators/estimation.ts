/**
 * Estimation — getting close, fast, without reaching for exactness.
 *
 * Graded on a band rather than a point, because that is the honest grading: the skill being tested
 * is knowing that 47 × 213 is "about ten thousand" in the time it takes to read it, and a marker
 * that demands 10,011 is testing something else entirely. Every band here is ±10%, and the
 * explanation shows the rounding that gets you inside it.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";
import { num } from "./arithmetic";

const BAND = 0.1;

interface Built {
  prompt: string;
  value: number;
  explanation: string;
}

type Builder = (rng: Rng) => Built;

const awkwardProduct: Builder = (rng) => {
  const a = rng.int(23, 97);
  const b = rng.int(104, 989);
  return {
    prompt: `Estimate ${a} \\times ${b}`,
    value: a * b,
    explanation: `Round to ${Math.round(a / 10) * 10} × ${Math.round(b / 100) * 100} = ${Math.round(a / 10) * 10 * (Math.round(b / 100) * 100)}. The exact value is ${a * b}.`,
  };
};

const awkwardQuotient: Builder = (rng) => {
  const b = rng.int(17, 89);
  const a = rng.int(400, 9000);
  return {
    prompt: `Estimate ${a} \\div ${b}`,
    value: a / b,
    explanation: `${b} goes into ${a} about ${Math.round(a / b)} times — ${b} × ${Math.round(a / b)} is ${b * Math.round(a / b)}.`,
  };
};

const reciprocal: Builder = (rng) => {
  const d = rng.pick([0.0032, 0.017, 0.043, 0.0071, 0.12, 0.0085]);
  return {
    prompt: `Estimate \\frac{1}{${d}}`,
    value: 1 / d,
    explanation: `1/${d} = ${num(Math.round((1 / d) * 10) / 10)}. Shift the decimal: 1/${d} is 1000/${d * 1000}.`,
  };
};

const bigRoot: Builder = (rng) => {
  const n = rng.int(200, 9000);
  return {
    prompt: `Estimate \\sqrt{${n}}`,
    value: Math.sqrt(n),
    explanation: `${Math.floor(Math.sqrt(n))}² = ${Math.floor(Math.sqrt(n)) ** 2} and ${Math.ceil(Math.sqrt(n))}² = ${Math.ceil(Math.sqrt(n)) ** 2}, so it is between them — about ${Math.sqrt(n).toFixed(1)}.`,
  };
};

const compounding: Builder = (rng) => {
  const principal = rng.pick([100, 250, 500, 1000]);
  const rate = rng.pick([0.05, 0.07, 0.08, 0.1, 0.12]);
  const years = rng.int(5, 20);
  const value = principal * (1 + rate) ** years;
  return {
    prompt: `${principal} grows at ${Math.round(rate * 100)}\\% a year for ${years} years. Estimate the final amount.`,
    value,
    explanation: `The rule of 72 says it doubles every ${Math.round(72 / (rate * 100))} years, so about ${(years / (72 / (rate * 100))).toFixed(1)} doublings — ${value.toFixed(0)}.`,
  };
};

const percentOfBig: Builder = (rng) => {
  const pct = rng.int(3, 87);
  const base = rng.int(1200, 98000);
  return {
    prompt: `Estimate ${pct}\\% of ${base}`,
    value: (pct / 100) * base,
    explanation: `1% of ${base} is ${num(base / 100)}, so ${pct}% is about ${((pct / 100) * base).toFixed(0)}.`,
  };
};

const powerOfTwo: Builder = (rng) => {
  const n = rng.int(11, 26);
  return {
    prompt: `Estimate 2^{${n}}`,
    value: 2 ** n,
    explanation: `2¹⁰ ≈ 1,000, so 2^${n} ≈ ${2 ** (n % 10)} × 10^${Math.floor(n / 10) * 3} — exactly ${2 ** n}.`,
  };
};

const ratio: Builder = (rng) => {
  const a = rng.int(140, 980);
  const b = rng.int(11, 79);
  return {
    prompt: `Roughly what percent of ${a} is ${b}?`,
    value: (b / a) * 100,
    explanation: `${b}/${a} ≈ ${(b / a).toFixed(3)}, so about ${((b / a) * 100).toFixed(1)}%.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [awkwardProduct, percentOfBig],
  2: [awkwardProduct, percentOfBig, bigRoot, awkwardQuotient],
  3: [awkwardProduct, awkwardQuotient, bigRoot, percentOfBig, ratio, powerOfTwo],
  4: [awkwardQuotient, reciprocal, compounding, powerOfTwo, ratio, bigRoot],
  5: [reciprocal, compounding, powerOfTwo, ratio, awkwardQuotient],
};

export function generateEstimation(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);
  const low = built.value * (1 - BAND);
  const high = built.value * (1 + BAND);
  return {
    id,
    kind: "estimation",
    prompt: built.prompt,
    answer: { type: "range", low: Math.min(low, high), high: Math.max(low, high) },
    explanation: `${built.explanation} Anything within 10% counts.`,
  };
}
