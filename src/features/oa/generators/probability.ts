/**
 * Discrete probability — dice, coins, cards, urns.
 *
 * Every answer here is an exact rational, so the explanation can show the fraction and the check
 * can accept either the fraction or a two-decimal rounding of it. A candidate under a clock writes
 * `5/36` or `0.14`, and both are the same right answer.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

/** Probabilities are accepted to two decimal places — nobody long-divides under a six-second clock. */
export const PROBABILITY_TOLERANCE = 0.005;

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** "5/36" — the form the explanation should show, because it is the form you reason in. */
function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  return `${n / g}/${d / g}`;
}

interface Built {
  prompt: string;
  value: number;
  explanation: string;
}

type Builder = (rng: Rng) => Built;

const twoDiceSum: Builder = (rng) => {
  const target = rng.int(4, 10);
  const ways = [...Array(6)].reduce((n, _, i) => {
    const a = i + 1;
    const b = target - a;
    return n + (b >= 1 && b <= 6 ? 1 : 0);
  }, 0);
  return {
    prompt: `Two fair dice are rolled. What is the probability the total is ${target}?`,
    value: ways / 36,
    explanation: `${ways} of the 36 ordered outcomes total ${target}, so ${frac(ways, 36)} ≈ ${(ways / 36).toFixed(3)}.`,
  };
};

const atLeastOne: Builder = (rng) => {
  const n = rng.int(2, 4);
  const faces = rng.pick([4, 6]);
  const p = 1 - ((faces - 1) / faces) ** n;
  return {
    prompt: `A fair ${faces}-sided die is rolled ${n} times. What is the probability of at least one ${faces}?`,
    value: p,
    explanation: `Take the complement: no ${faces} in ${n} rolls is (${faces - 1}/${faces})^${n}, so the answer is 1 − that = ${p.toFixed(4)}.`,
  };
};

const exactlyKHeads: Builder = (rng) => {
  const n = rng.int(4, 7);
  const k = rng.int(2, n - 1);
  const p = choose(n, k) / 2 ** n;
  return {
    prompt: `A fair coin is flipped ${n} times. What is the probability of exactly ${k} heads?`,
    value: p,
    explanation: `C(${n},${k}) = ${choose(n, k)} of the ${2 ** n} equally likely sequences, so ${frac(choose(n, k), 2 ** n)} ≈ ${p.toFixed(4)}.`,
  };
};

const urnWithout: Builder = (rng) => {
  const red = rng.int(3, 7);
  const blue = rng.int(3, 7);
  const total = red + blue;
  const p = (red / total) * ((red - 1) / (total - 1));
  return {
    prompt: `A bag holds ${red} red and ${blue} blue balls. Two are drawn without replacement. What is the probability both are red?`,
    value: p,
    explanation: `(${red}/${total}) × (${red - 1}/${total - 1}) = ${frac(red * (red - 1), total * (total - 1))} ≈ ${p.toFixed(4)}.`,
  };
};

const cardDraw: Builder = (rng) => {
  const kind = rng.pick(["both hearts", "both aces", "both face cards"] as const);
  const counts = { "both hearts": 13, "both aces": 4, "both face cards": 12 };
  const c = counts[kind];
  const p = (c / 52) * ((c - 1) / 51);
  return {
    prompt: `Two cards are drawn from a standard 52-card deck without replacement. What is the probability they are ${kind}?`,
    value: p,
    explanation: `(${c}/52) × (${c - 1}/51) = ${frac(c * (c - 1), 52 * 51)} ≈ ${p.toFixed(4)}.`,
  };
};

const conditional: Builder = (rng) => {
  const total = rng.pick([100, 200, 400]);
  const rate = rng.pick([0.01, 0.02, 0.05]);
  const sens = rng.pick([0.9, 0.95]);
  const fpr = rng.pick([0.05, 0.1]);
  const sick = total * rate;
  const truePos = sick * sens;
  const falsePos = (total - sick) * fpr;
  const p = truePos / (truePos + falsePos);
  return {
    prompt: `${Math.round(rate * 100)}% of a population has a condition. A test catches ${Math.round(sens * 100)}% of cases and wrongly flags ${Math.round(fpr * 100)}% of healthy people. Someone tests positive — what is the probability they have it?`,
    value: p,
    explanation: `Out of ${total}: ${truePos.toFixed(1)} true positives and ${falsePos.toFixed(1)} false ones, so ${truePos.toFixed(1)} / ${(truePos + falsePos).toFixed(1)} ≈ ${p.toFixed(3)}.`,
  };
};

const birthdayLike: Builder = (rng) => {
  const people = rng.int(3, 5);
  const days = rng.pick([7, 10, 12]);
  let p = 1;
  for (let i = 0; i < people; i++) p *= (days - i) / days;
  return {
    prompt: `${people} people each pick one of ${days} days at random. What is the probability all ${people} picks are different?`,
    value: p,
    explanation: `${Array.from({ length: people }, (_, i) => `${days - i}/${days}`).join(" × ")} ≈ ${p.toFixed(4)}.`,
  };
};

const diceHigher: Builder = (rng) => {
  const faces = rng.pick([4, 6]);
  const p = (faces - 1) / (2 * faces);
  return {
    prompt: `Two fair ${faces}-sided dice are rolled. What is the probability the first is strictly greater than the second?`,
    value: p,
    explanation: `They tie ${faces}/${faces * faces} of the time; the rest splits evenly, so (1 − 1/${faces}) / 2 = ${frac(faces - 1, 2 * faces)} ≈ ${p.toFixed(4)}.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [twoDiceSum, diceHigher],
  2: [twoDiceSum, atLeastOne, exactlyKHeads, diceHigher],
  3: [twoDiceSum, atLeastOne, exactlyKHeads, urnWithout, cardDraw, diceHigher],
  4: [atLeastOne, exactlyKHeads, urnWithout, cardDraw, birthdayLike, conditional],
  5: [urnWithout, cardDraw, birthdayLike, conditional, atLeastOne],
};

export function generateProbability(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);
  return {
    id,
    kind: "probability",
    prompt: built.prompt,
    answer: { type: "numeric", value: built.value, tolerance: PROBABILITY_TOLERANCE },
    explanation: built.explanation,
  };
}
