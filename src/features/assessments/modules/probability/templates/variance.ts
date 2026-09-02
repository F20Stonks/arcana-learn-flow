/**
 * Variance and the E[X^2] vs (E[X])^2 confusion, via the variance of a sum of iid dice. Verified
 * in generate.test.ts by simulating many sums of n dice and comparing the sample variance to the
 * closed form (Monte Carlo).
 */
import { randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

// Single fair die: E[X] = 3.5, E[X^2] = 91/6, Var(X) = 91/6 - 3.5^2 = 35/12.
const SINGLE_DIE_MEAN = 3.5;
const SINGLE_DIE_E_X2 = 91 / 6;
const SINGLE_DIE_VARIANCE = SINGLE_DIE_E_X2 - SINGLE_DIE_MEAN * SINGLE_DIE_MEAN;

/** Var(sum of n iid fair dice) = n * Var(single die), by independence. */
export const varianceSumDice: ProbTemplate = {
  id: "prob_variance_sum_dice",
  topic: "variance",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(2, 10, rng);
    const correct = n * SINGLE_DIE_VARIANCE;

    return {
      tag: "prob_variance_sum_dice",
      prompt: `${n} fair six-sided dice are rolled and summed. What is the variance of the sum?`,
      correct,
      explanation: `Var(single die) = E[X²] − (E[X])² = 91/6 − 3.5² = 35/12. Since the dice are independent, Var(sum) = n·Var(single die) = ${n}·35/12.`,
      distractors: [
        // Confused E[X^2] with Var(X): scaled E[X^2] by n, forgetting to subtract (E[X])^2 first.
        { value: n * SINGLE_DIE_E_X2, reasoning: "computed n·E[X²] and forgot to subtract n·(E[X])² to get the variance" },
        // Scaled variance quadratically, as if it behaved like a standard deviation under summing.
        { value: n * n * SINGLE_DIE_VARIANCE, reasoning: "scaled variance by n², as if summing n independent variables scaled variance quadratically instead of linearly" },
        // Reported the standard deviation of the sum instead of the variance.
        { value: Math.sqrt(n * SINGLE_DIE_VARIANCE), reasoning: "reported the standard deviation of the sum instead of the variance" },
        // Forgot to scale by n at all.
        { value: SINGLE_DIE_VARIANCE, reasoning: "reported the variance of a single die and forgot to scale by n" },
      ],
    };
  },
};
