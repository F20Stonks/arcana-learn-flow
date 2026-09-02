/**
 * Mental arithmetic, the Optiver "80 in 8" shape.
 *
 * Eighty questions in eight minutes is six seconds each, which is the whole point: nothing here is
 * hard, and the only way through is to have the tables, the fraction-decimal conversions and the
 * ×0.5 / ÷0.25 tricks already in your hands. So the generator's job is not to be difficult, it is
 * to be *relentless* and to keep the answers clean — a question whose answer is 6.833333 tests a
 * candidate's patience rather than their arithmetic, and the real paper does not do that.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

/** Kill floating-point dust: 0.1 * 3 must present as 0.3, not 0.30000000000000004. */
export function clean(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

/** How a number is written on the page — no trailing zeros, no exponent notation. */
export function num(n: number): string {
  const v = clean(n);
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(6)));
}

type Builder = (rng: Rng) => { prompt: string; value: number; explanation: string };

const times: Builder = (rng) => {
  const a = rng.int(3, 19);
  const b = rng.int(3, 19);
  return {
    prompt: `${a} \\times ${b}`,
    value: a * b,
    explanation: `${a} × ${b} = ${a * b}.`,
  };
};

const bigTimes: Builder = (rng) => {
  const a = rng.int(12, 99);
  const b = rng.pick([11, 12, 15, 25, 50, 99, 101]);
  const hint: Record<number, string> = {
    11: `×11 is the number plus itself shifted one place: ${a} × 11 = ${a * 10} + ${a}.`,
    12: `×12 is ×10 + ×2: ${a * 10} + ${a * 2}.`,
    15: `×15 is ×10 plus half of that: ${a * 10} + ${a * 5}.`,
    25: `×25 is ×100 ÷ 4: ${a * 100} ÷ 4.`,
    50: `×50 is ×100 ÷ 2: ${a * 100} ÷ 2.`,
    99: `×99 is ×100 − the number: ${a * 100} − ${a}.`,
    101: `×101 is ×100 + the number: ${a * 100} + ${a}.`,
  };
  return { prompt: `${a} \\times ${b}`, value: a * b, explanation: hint[b] };
};

const addSub: Builder = (rng) => {
  const a = rng.int(-199, 499);
  const b = rng.int(-199, 499);
  const plus = rng.chance(0.5);
  const value = plus ? a + b : a - b;
  const rhs = b < 0 ? `(${b})` : `${b}`;
  return {
    prompt: `${a} ${plus ? "+" : "-"} ${rhs}`,
    value,
    explanation: `${a} ${plus ? "+" : "−"} ${b} = ${value}.`,
  };
};

const exactDivide: Builder = (rng) => {
  const b = rng.int(3, 19);
  const q = rng.int(3, 30);
  return {
    prompt: `${b * q} \\div ${b}`,
    value: q,
    explanation: `${b} × ${q} = ${b * q}, so the answer is ${q}.`,
  };
};

/** Dividing by a half or a quarter is multiplying — the single most common OA trip-up. */
const divideByFraction: Builder = (rng) => {
  const d = rng.pick([0.5, 0.25, 0.2, 0.125]);
  const a = rng.int(2, 60);
  const factor = 1 / d;
  return {
    prompt: `${a} \\div ${num(d)}`,
    value: clean(a * factor),
    explanation: `Dividing by ${num(d)} is multiplying by ${num(factor)}: ${a} × ${num(factor)} = ${num(a * factor)}.`,
  };
};

const decimalTimes: Builder = (rng) => {
  const a = rng.pick([0.2, 0.25, 0.4, 0.5, 0.75, 1.5, 2.5, 0.05]);
  const b = rng.int(4, 240);
  return {
    prompt: `${num(a)} \\times ${b}`,
    value: clean(a * b),
    explanation: `${num(a)} × ${b} = ${num(a * b)}.`,
  };
};

const percentOf: Builder = (rng) => {
  const pct = rng.pick([5, 10, 12.5, 15, 20, 25, 30, 40, 60, 75, 80, 150]);
  const base = rng.pick([20, 40, 60, 80, 120, 160, 200, 240, 400, 800]);
  return {
    prompt: `${num(pct)}\\% \\text{ of } ${base}`,
    value: clean((pct / 100) * base),
    explanation: `${num(pct)}% of ${base} = ${num(pct / 100)} × ${base} = ${num((pct / 100) * base)}.`,
  };
};

/** The conversions worth knowing cold: eighths, sixteenths, twelfths, twentieths. */
const fractionToDecimal: Builder = (rng) => {
  const [n, d] = rng.pick([
    [1, 8], [3, 8], [5, 8], [7, 8],
    [1, 16], [3, 16], [1, 4], [3, 4],
    [1, 5], [2, 5], [3, 5], [4, 5],
    [1, 20], [3, 20], [1, 2], [1, 25],
  ]);
  return {
    prompt: `\\frac{${n}}{${d}} \\text{ as a decimal}`,
    value: clean(n / d),
    explanation: `${n}/${d} = ${num(n / d)}.`,
  };
};

const square: Builder = (rng) => {
  const a = rng.int(11, 30);
  return { prompt: `${a}^2`, value: a * a, explanation: `${a}² = ${a * a}.` };
};

const squareRoot: Builder = (rng) => {
  const a = rng.int(4, 25);
  return { prompt: `\\sqrt{${a * a}}`, value: a, explanation: `${a}² = ${a * a}, so the root is ${a}.` };
};

/** Two operations, which is where order of operations starts costing people marks. */
const twoStep: Builder = (rng) => {
  const a = rng.int(3, 15);
  const b = rng.int(3, 12);
  const c = rng.int(2, 60);
  const plus = rng.chance(0.5);
  const value = plus ? a * b + c : a * b - c;
  return {
    prompt: `${a} \\times ${b} ${plus ? "+" : "-"} ${c}`,
    value,
    explanation: `Multiply first: ${a} × ${b} = ${a * b}, then ${plus ? "+" : "−"} ${c} = ${value}.`,
  };
};

const percentChange: Builder = (rng) => {
  const from = rng.pick([20, 25, 40, 50, 80, 120, 200, 250]);
  const pct = rng.pick([10, 20, 25, 50, 100]);
  const up = rng.chance(0.5);
  const value = clean(from * (up ? 1 + pct / 100 : 1 - pct / 100));
  return {
    prompt: `${from} \\text{ increased by } ${pct}\\%`.replace("increased", up ? "increased" : "decreased"),
    value,
    explanation: `${pct}% of ${from} is ${num((pct / 100) * from)}, so the answer is ${num(value)}.`,
  };
};

const negativeTimes: Builder = (rng) => {
  const a = rng.int(3, 15) * (rng.chance(0.5) ? -1 : 1);
  const b = rng.int(3, 15) * (rng.chance(0.5) ? -1 : 1);
  return {
    prompt: `(${a}) \\times (${b})`,
    value: a * b,
    explanation: `Signs first — ${a < 0 !== b < 0 ? "one negative, so negative" : "same sign, so positive"} — then ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a * b)}.`,
  };
};

/**
 * The mix, by level. Level 1 is warm-up tables; level 3 is the real 80-in-8 blend; level 5 leans
 * on the conversions and the two-steppers that separate a 60 from a 75.
 */
const MIX: Record<number, Builder[]> = {
  1: [times, addSub, exactDivide, square],
  2: [times, addSub, exactDivide, decimalTimes, percentOf, square],
  3: [times, bigTimes, addSub, exactDivide, divideByFraction, decimalTimes, percentOf, fractionToDecimal, square, squareRoot],
  4: [bigTimes, addSub, divideByFraction, decimalTimes, percentOf, fractionToDecimal, twoStep, percentChange, negativeTimes, squareRoot],
  5: [bigTimes, divideByFraction, decimalTimes, percentOf, fractionToDecimal, twoStep, percentChange, negativeTimes],
};

export function generateArithmetic(rng: Rng, level: number, id: string): Question {
  const builders = MIX[Math.min(5, Math.max(1, level))];
  const built = rng.pick(builders)(rng);
  return {
    id,
    kind: "arithmetic",
    prompt: built.prompt,
    answer: { type: "numeric", value: clean(built.value) },
    explanation: built.explanation,
  };
}
