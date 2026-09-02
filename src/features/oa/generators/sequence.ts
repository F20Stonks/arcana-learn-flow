/**
 * Number sequences — the one question type that turns up in almost every firm's OA (SIG and IMC
 * lean on them hardest, Optiver and Old Mission use them too).
 *
 * A sequence question is only fair if exactly one rule fits the terms shown, so every pattern here
 * shows at least five terms: with four, "2 4 8 16" is as legitimately 2ⁿ as it is a
 * fourth-difference polynomial, and a candidate who spots the second reading is punished for it.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

interface Pattern {
  terms: number[];
  next: number;
  explanation: string;
}

type Builder = (rng: Rng) => Pattern;

const from = (n: number, f: (i: number) => number): number[] =>
  Array.from({ length: n }, (_, i) => f(i));

const arithmetic: Builder = (rng) => {
  const a = rng.int(-12, 30);
  const d = rng.int(2, 14) * (rng.chance(0.25) ? -1 : 1);
  const terms = from(6, (i) => a + i * d);
  return {
    terms,
    next: a + 6 * d,
    explanation: `Each term is ${d > 0 ? "+" : "−"}${Math.abs(d)} on the last.`,
  };
};

const geometric: Builder = (rng) => {
  const a = rng.int(1, 6);
  const r = rng.pick([2, 3, -2, 5]);
  const terms = from(6, (i) => a * r ** i);
  return {
    terms,
    next: a * r ** 6,
    explanation: `Each term is the last × ${r}.`,
  };
};

/** Constant second difference — a quadratic in n, and the classic "look at the gaps" prompt. */
const quadratic: Builder = (rng) => {
  const a = rng.int(1, 4);
  const b = rng.int(-4, 6);
  const c = rng.int(-6, 12);
  const f = (n: number) => a * n * n + b * n + c;
  return {
    terms: from(6, (i) => f(i + 1)),
    next: f(7),
    explanation: `The gaps grow by a constant ${2 * a} each time — it is ${a}n² ${b >= 0 ? "+" : "−"} ${Math.abs(b)}n ${c >= 0 ? "+" : "−"} ${Math.abs(c)}.`,
  };
};

const fibonacci: Builder = (rng) => {
  const a = rng.int(1, 8);
  const b = rng.int(2, 11);
  const terms = [a, b];
  for (let i = 2; i < 7; i++) terms.push(terms[i - 1] + terms[i - 2]);
  return {
    terms: terms.slice(0, 6),
    next: terms[6],
    explanation: `Each term is the sum of the two before it: ${terms[4]} + ${terms[5]} = ${terms[6]}.`,
  };
};

/** Two operations alternating — reads as chaos until you look at every other gap. */
const alternatingOps: Builder = (rng) => {
  const start = rng.int(2, 9);
  const add = rng.int(2, 9);
  const mul = rng.pick([2, 3]);
  const terms = [start];
  for (let i = 1; i < 7; i++) {
    terms.push(i % 2 === 1 ? terms[i - 1] * mul : terms[i - 1] + add);
  }
  return {
    terms: terms.slice(0, 6),
    next: terms[6],
    explanation: `The operations alternate: × ${mul}, then + ${add}, then × ${mul} again.`,
  };
};

/** Two sequences woven together — odd positions climb one way, even positions another. */
const interleaved: Builder = (rng) => {
  const a = rng.int(1, 9);
  const da = rng.int(2, 8);
  const b = rng.int(20, 60);
  const db = -rng.int(2, 9);
  const terms: number[] = [];
  for (let i = 0; i < 7; i++) {
    terms.push(i % 2 === 0 ? a + (i / 2) * da : b + ((i - 1) / 2) * db);
  }
  return {
    terms: terms.slice(0, 6),
    next: terms[6],
    explanation: `Two sequences interleaved: the 1st, 3rd, 5th go up by ${da}; the 2nd, 4th, 6th go down by ${Math.abs(db)}.`,
  };
};

const squaresOffset: Builder = (rng) => {
  const k = rng.int(-5, 9);
  const f = (n: number) => n * n + k;
  return {
    terms: from(6, (i) => f(i + 1)),
    next: f(7),
    explanation: `Square numbers ${k >= 0 ? "+" : "−"} ${Math.abs(k)}: 1, 4, 9, 16, 25, 36 shifted.`,
  };
};

const cubes: Builder = (rng) => {
  const k = rng.int(-3, 5);
  const f = (n: number) => n ** 3 + k;
  return {
    terms: from(6, (i) => f(i + 1)),
    next: f(7),
    explanation: `Cubes ${k >= 0 ? "+" : "−"} ${Math.abs(k)}: 1, 8, 27, 64, 125, 216 shifted.`,
  };
};

const multiplyAndAdd: Builder = (rng) => {
  const m = rng.pick([2, 3]);
  const add = rng.int(1, 7);
  const start = rng.int(1, 5);
  const terms = [start];
  for (let i = 1; i < 7; i++) terms.push(terms[i - 1] * m + add);
  return {
    terms: terms.slice(0, 6),
    next: terms[6],
    explanation: `Each term is the last × ${m} + ${add}.`,
  };
};

const triangular: Builder = (rng) => {
  const scale = rng.pick([1, 2]);
  const f = (n: number) => (scale * n * (n + 1)) / 2;
  return {
    terms: from(6, (i) => f(i + 1)),
    next: f(7),
    explanation:
      scale === 1
        ? "Triangular numbers: the gaps go 2, 3, 4, 5, 6."
        : "Twice the triangular numbers — n(n+1).",
  };
};

const differenceOfDifferences: Builder = (rng) => {
  const start = rng.int(1, 10);
  const d0 = rng.int(1, 5);
  const dd = rng.int(1, 4);
  const terms = [start];
  let d = d0;
  for (let i = 1; i < 7; i++) {
    terms.push(terms[i - 1] + d);
    d += dd;
  }
  return {
    terms: terms.slice(0, 6),
    next: terms[6],
    explanation: `The gaps themselves go up by ${dd}: ${d0}, ${d0 + dd}, ${d0 + 2 * dd}, and so on.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [arithmetic, geometric, squaresOffset],
  2: [arithmetic, geometric, squaresOffset, triangular, fibonacci],
  3: [geometric, quadratic, fibonacci, squaresOffset, cubes, multiplyAndAdd, differenceOfDifferences],
  4: [quadratic, fibonacci, alternatingOps, multiplyAndAdd, differenceOfDifferences, interleaved, cubes],
  5: [alternatingOps, interleaved, multiplyAndAdd, quadratic, differenceOfDifferences],
};

export function generateSequence(rng: Rng, level: number, id: string): Question {
  const pattern = MIX[Math.min(5, Math.max(1, level))];
  const built = rng.pick(pattern)(rng);
  return {
    id,
    kind: "sequence",
    prompt: `${built.terms.join(",\\; ")},\\; \\text{?}`,
    answer: { type: "numeric", value: built.next },
    explanation: `${built.explanation} The next term is ${built.next}.`,
  };
}
