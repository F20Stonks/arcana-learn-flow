/**
 * Gambler's ruin: a gambler with $i bets $1 repeatedly against a bank at $N, winning each round
 * with probability p, until reaching $0 or $N. Verified in generate.test.ts by simulating the
 * random walk many times and checking the sample fraction that reaches N first (Monte Carlo).
 */
import { pick, randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

interface Rate {
  value: number;
  label: string;
}

/** p = 1/2 excluded deliberately — the fair case is its own template below, with its own (simpler)
 *  closed form; mixing the two here would need a branch inside the formula for no benefit. */
const BIASED_P: Rate[] = [
  { value: 1 / 4, label: "1/4" },
  { value: 2 / 5, label: "2/5" },
  { value: 3 / 5, label: "3/5" },
  { value: 3 / 4, label: "3/4" },
  { value: 1 / 3, label: "1/3" },
  { value: 2 / 3, label: "2/3" },
  { value: 1 / 5, label: "1/5" },
  { value: 4 / 5, label: "4/5" },
];

function ratioRuinProb(r: number, i: number, N: number): number {
  return (1 - Math.pow(r, i)) / (1 - Math.pow(r, N));
}

/** P(reach $N before $0 | start at $i, win prob p) = (1 - r^i) / (1 - r^N), r = (1-p)/p. */
export const gamblersRuinBiased: ProbTemplate = {
  id: "prob_gamblers_ruin_biased",
  topic: "gamblers-ruin",
  difficulty: 3,
  generate: (rng) => {
    const p = pick(BIASED_P, rng);
    const N = randInt(4, 12, rng);
    const i = randInt(1, N - 1, rng);
    const r = (1 - p.value) / p.value;
    const correct = ratioRuinProb(r, i, N);
    const iOff = i > 1 ? i - 1 : i + 1;

    return {
      tag: "prob_gamblers_ruin_biased",
      prompt: `A gambler starts with $${i} and repeatedly bets $1 on a game won with probability ${p.label}, stopping at $0 or at $${N}. What is the probability the gambler reaches $${N} before going broke?`,
      correct,
      isProbability: true,
      explanation: `With r = (1-p)/p = (1 − ${p.label})/${p.label}, the classic gambler's-ruin formula gives P(reach N first | start i) = (1 − r^i)/(1 − r^N).`,
      distractors: [
        // Used the fair-game formula i/N even though the game is biased.
        { value: i / N, reasoning: "used the fair-game formula i/N even though the win probability is not 1/2" },
        // Inverted the odds ratio.
        { value: ratioRuinProb(1 / r, i, N), reasoning: "inverted the odds ratio — used p/(1-p) instead of (1-p)/p" },
        // Computed the complementary event (ruin) instead of success.
        { value: 1 - correct, reasoning: "computed P(going broke first) instead of P(reaching the target first)" },
        // Off-by-one in the starting capital used in the formula.
        { value: ratioRuinProb(r, iOff, N), reasoning: "off-by-one — used a starting capital of $" + iOff + " instead of $" + i + " in the formula" },
      ],
    };
  },
};

/** Fair game (p = 1/2): P(reach $N before $0 | start at $i) = i / N. */
export const gamblersRuinFair: ProbTemplate = {
  id: "prob_gamblers_ruin_fair",
  topic: "gamblers-ruin",
  difficulty: 2,
  generate: (rng) => {
    const N = randInt(4, 14, rng);
    const i = randInt(1, N - 1, rng);
    const correct = i / N;

    return {
      tag: "prob_gamblers_ruin_fair",
      prompt: `A gambler starts with $${i} and repeatedly bets $1 on a fair coin flip, stopping at $0 or at $${N}. What is the probability the gambler reaches $${N} before going broke?`,
      correct,
      isProbability: true,
      explanation: `The gambler's capital is a martingale under a fair game, so E[final capital] = i. Since the only outcomes are $0 and $N, P(reach N first)·N = i, giving P = i/N.`,
      distractors: [
        // Complement — probability of going broke first.
        { value: (N - i) / N, reasoning: "computed P(going broke first) instead of P(reaching the target first)" },
        // Treated the (linear) martingale probability as if it scaled quadratically.
        { value: Math.pow(i / N, 2), reasoning: "squared the ratio, as if the probability scaled quadratically with starting capital instead of linearly" },
        // Off-by-one in the starting capital.
        { value: (i + 1) / N, reasoning: "off-by-one — used a starting capital of $" + (i + 1) + " instead of $" + i },
        // Used the odds i:(N-i) instead of the probability i/N.
        { value: i / (N - i), reasoning: "computed the odds i/(N-i) instead of the probability i/N" },
      ],
    };
  },
};
