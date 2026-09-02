/**
 * Fair-coin templates. Verified in generate.test.ts by simulating batches of coin flips and
 * comparing the sample proportion to the closed form (Monte Carlo).
 */
import { randInt } from "../../../engine/rng";
import { choose } from "../format";
import type { ProbTemplate } from "./types";

/** P(at least one head in n fair flips) = 1 - (1/2)^n. */
export const coinAtLeastOneHead: ProbTemplate = {
  id: "prob_coin_at_least_one_head",
  topic: "coin",
  difficulty: 1,
  generate: (rng) => {
    const n = randInt(3, 10, rng);
    const correct = 1 - Math.pow(0.5, n);
    return {
      tag: "prob_coin_at_least_one_head",
      prompt: `A fair coin is flipped ${n} times. What is the probability of at least one head?`,
      correct,
      isProbability: true,
      explanation: `P(at least one head) = 1 − P(no heads) = 1 − (1/2)^${n}.`,
      distractors: [
        // Took the complement — reported P(no heads) itself.
        { value: Math.pow(0.5, n), reasoning: "reported P(no heads) itself instead of its complement" },
        // Only counted the n sequences with exactly one head, missing every sequence with two or
        // more heads — undercounts the favourable outcomes.
        { value: n / Math.pow(2, n), reasoning: "counted only the sequences with exactly one head, not all outcomes with at least one" },
        // Off-by-one in the exponent.
        { value: 1 - Math.pow(0.5, n - 1), reasoning: "off-by-one — used n−1 flips in the complement" },
        { value: 1 - Math.pow(0.5, n + 1), reasoning: "off-by-one — used n+1 flips in the complement" },
      ],
    };
  },
};

/** P(exactly k heads in n fair flips) = C(n,k) / 2^n. */
export const coinExactKHeads: ProbTemplate = {
  id: "prob_coin_exact_k_heads",
  topic: "coin",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(5, 12, rng);
    const k = randInt(1, n - 1, rng);
    const total = Math.pow(2, n);
    const correct = choose(n, k) / total;

    // Off-by-one in the count: try k+1, then k-1, then k+2, then k-2, taking the first whose
    // C(n, ·) collides with neither C(n,k) (the symmetric point n = 2k+1) nor 1 (which would tie
    // this distractor to the "forgot the combinatorial factor" one, C(n,n-1)/2^n = 1/2^n).
    const forbidden = new Set([choose(n, k), 1]);
    const offsetK =
      [k + 1, k - 1, k + 2, k - 2].filter((c) => c >= 0 && c <= n).find((c) => !forbidden.has(choose(n, c))) ?? k + 1;

    return {
      tag: "prob_coin_exact_k_heads",
      prompt: `A fair coin is flipped ${n} times. What is the probability of exactly ${k} heads?`,
      correct,
      isProbability: true,
      explanation: `P(exactly ${k} heads) = C(${n}, ${k}) / 2^${n} = ${choose(n, k)}/${total}.`,
      distractors: [
        // Forgot the combinatorial count — used the probability of one specific sequence.
        { value: 1 / total, reasoning: "forgot the combinatorial factor — used the probability of a single specific sequence" },
        // Off-by-one in which row of Pascal's triangle to use.
        { value: choose(n, offsetK) / total, reasoning: `off-by-one in the count — used C(${n}, ${offsetK}) instead of C(${n}, ${k})` },
        // Confused "exactly k" with "at most k" (k >= 1, so this cumulative sum is strictly larger).
        {
          value: Array.from({ length: k + 1 }, (_, i) => choose(n, i)).reduce((a, b) => a + b, 0) / total,
          reasoning: "computed P(at most k heads) instead of P(exactly k heads)",
        },
        // Divided by n instead of the total number of outcomes 2^n.
        { value: choose(n, k) / n, reasoning: "divided by n instead of the total outcome count 2^n" },
      ],
    };
  },
};
