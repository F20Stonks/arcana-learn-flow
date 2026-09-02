/**
 * Expected value / fair pricing of a bet. Verified in generate.test.ts by simulating many plays of
 * the die roll and averaging the payout (Monte Carlo).
 */
import { randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

/** Fair price of a die-roll bet: pays $win if the roll is <= k, costs $lose otherwise. */
export const evFairPriceDieBet: ProbTemplate = {
  id: "prob_ev_fair_price_die",
  topic: "expected-value",
  difficulty: 2,
  generate: (rng) => {
    const win = randInt(10, 50, rng);
    const lose = randInt(5, 25, rng);
    // k in [2,5] keeps both branches non-trivial (at least 2 faces each) and k-1 >= 1, which the
    // off-by-one distractor below needs.
    const k = randInt(2, 5, rng);
    const winFaces = k;
    const loseFaces = 6 - k;
    const correct = (win * winFaces - lose * loseFaces) / 6;

    return {
      tag: "prob_ev_fair_price_die",
      prompt: `You are offered a bet on a fair six-sided die roll: if the result is ${k} or less, you receive $${win}; otherwise, you pay $${lose}. What is the fair price of this bet (its expected value)?`,
      correct,
      explanation: `E[payout] = $${win}·P(roll ≤ ${k}) − $${lose}·P(roll > ${k}) = ${win}·(${winFaces}/6) − ${lose}·(${loseFaces}/6).`,
      distractors: [
        // Swapped which probability weights which payout.
        {
          value: (win * loseFaces - lose * winFaces) / 6,
          reasoning: "swapped the weights — applied P(roll > k) to the win payout and P(roll ≤ k) to the loss",
        },
        // Simple average of the two payouts, ignoring the probabilities entirely.
        { value: (win - lose) / 2, reasoning: "took the simple average of the two payouts, ignoring their probabilities" },
        // Forgot to normalize by the total number of outcomes.
        { value: win * winFaces - lose * loseFaces, reasoning: "forgot to divide by 6 — used raw face counts instead of probabilities" },
        // Off-by-one in the boundary between the two branches.
        {
          value: (win * (k - 1) - lose * (6 - (k - 1))) / 6,
          reasoning: `off-by-one — treated "${k} or less" as ${k - 1} favourable faces`,
        },
      ],
    };
  },
};
