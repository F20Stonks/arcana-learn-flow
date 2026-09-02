/**
 * Expected value — "would you play this game, and at what price?"
 *
 * This is the question type a trading firm actually cares about, and the one candidates most often
 * answer with instinct rather than arithmetic. Every game here has a closed-form EV, and the
 * explanation shows the sum rather than the answer, because the sum is the transferable part.
 */
import type { Rng } from "../rng";
import type { Question } from "../types";

/** Money answers are accepted to the nearest penny. */
export const EV_TOLERANCE = 0.005;

interface Built {
  prompt: string;
  value: number;
  explanation: string;
}

type Builder = (rng: Rng) => Built;

const money = (n: number) => `\\$${Number(n.toFixed(2))}`;

const dieFaceValue: Builder = (rng) => {
  const faces = rng.pick([4, 6, 8, 10, 12, 20]);
  const ev = (faces + 1) / 2;
  return {
    prompt: `You roll a fair ${faces}-sided die and are paid its face value in dollars. What is the fair price to play?`,
    value: ev,
    explanation: `The mean of 1…${faces} is (1 + ${faces})/2 = ${ev}.`,
  };
};

const rerollOnce: Builder = (rng) => {
  const faces = rng.pick([6, 10]);
  // Keep the first roll when it beats the EV of a fresh roll; otherwise reroll.
  const fresh = (faces + 1) / 2;
  const threshold = Math.floor(fresh);
  let ev = 0;
  for (let r = 1; r <= faces; r++) ev += (r > threshold ? r : fresh) / faces;
  return {
    prompt: `You roll a fair ${faces}-sided die and are paid its face value, but you may reroll once and must then take the second roll. Playing optimally, what is the game worth?`,
    value: ev,
    explanation: `A fresh roll is worth ${fresh}, so keep anything above ${threshold} and reroll otherwise. That gives ${ev.toFixed(4)}.`,
  };
};

const coinUntilHeads: Builder = (rng) => {
  const p = rng.pick([0.5, 0.25, 0.2]);
  return {
    prompt: `A coin lands heads with probability ${p}. How many flips on average until the first head?`,
    value: 1 / p,
    explanation: `The wait for a first success is 1/p = 1/${p} = ${1 / p}.`,
  };
};

const payoffGame: Builder = (rng) => {
  const win = rng.int(3, 12);
  const lose = rng.int(1, 8);
  const faces = 6;
  const winOn = rng.int(1, 4);
  const ev = (winOn / faces) * win - ((faces - winOn) / faces) * lose;
  return {
    prompt: `Roll a fair die: you win ${money(win)} if it shows ${winOn} or less, and lose ${money(lose)} otherwise. What is the expected profit per play?`,
    value: ev,
    explanation: `(${winOn}/6)(${win}) − (${faces - winOn}/6)(${lose}) = ${ev.toFixed(4)}.`,
  };
};

const maxOfTwo: Builder = (rng) => {
  const faces = rng.pick([4, 6]);
  let ev = 0;
  for (let m = 1; m <= faces; m++) ev += (m * (m * m - (m - 1) * (m - 1))) / (faces * faces);
  return {
    prompt: `Two fair ${faces}-sided dice are rolled and you are paid the higher of the two. What is the expected payout?`,
    value: ev,
    explanation: `P(max = m) = (m² − (m−1)²)/${faces * faces}. Summing m × that over m = 1…${faces} gives ${ev.toFixed(4)}.`,
  };
};

const insuranceStyle: Builder = (rng) => {
  const stake = rng.pick([10, 20, 50, 100]);
  const p = rng.pick([0.02, 0.05, 0.1]);
  const loss = stake * rng.int(4, 12);
  const ev = -p * loss;
  return {
    prompt: `An event happens with probability ${p} and costs you ${money(loss)} when it does. What is the most you should pay to insure against it, ignoring risk preference?`,
    value: -ev,
    explanation: `The expected loss is ${p} × ${loss} = ${(p * loss).toFixed(2)}, which is the break-even premium.`,
  };
};

const cardsExpected: Builder = (rng) => {
  const draws = rng.int(2, 5);
  const ev = draws * (13 / 52);
  return {
    prompt: `${draws} cards are drawn from a standard deck with replacement. How many hearts do you expect?`,
    value: ev,
    explanation: `Each draw is a heart with probability 1/4, so ${draws} × 0.25 = ${ev}.`,
  };
};

const sumOfDice: Builder = (rng) => {
  const n = rng.int(2, 6);
  const faces = rng.pick([6, 8]);
  const ev = (n * (faces + 1)) / 2;
  return {
    prompt: `${n} fair ${faces}-sided dice are rolled. What is the expected total?`,
    value: ev,
    explanation: `Each die averages ${(faces + 1) / 2}, and expectation adds: ${n} × ${(faces + 1) / 2} = ${ev}.`,
  };
};

const MIX: Record<number, Builder[]> = {
  1: [dieFaceValue, sumOfDice, cardsExpected],
  2: [dieFaceValue, sumOfDice, cardsExpected, payoffGame, coinUntilHeads],
  3: [payoffGame, coinUntilHeads, insuranceStyle, sumOfDice, maxOfTwo],
  4: [rerollOnce, maxOfTwo, payoffGame, insuranceStyle, coinUntilHeads],
  5: [rerollOnce, maxOfTwo, insuranceStyle, payoffGame],
};

export function generateExpectedValue(rng: Rng, level: number, id: string): Question {
  const built = rng.pick(MIX[Math.min(5, Math.max(1, level))])(rng);
  return {
    id,
    kind: "expected-value",
    prompt: built.prompt,
    answer: { type: "numeric", value: built.value, tolerance: EV_TOLERANCE },
    explanation: built.explanation,
  };
}
