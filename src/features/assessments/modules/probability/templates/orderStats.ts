/**
 * Order statistics: expected max of a small sample, continuous and discrete. The continuous case
 * is verified by Monte Carlo (you cannot enumerate a continuum); the discrete dice case is verified
 * by brute-force enumeration of the (small) finite outcome space, exactly like the dice templates.
 */
import { randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

/** E[max of n iid Uniform(0,1)] = n / (n+1). n starts at 3: at n=2, two of the distractors below
 *  (the constant 0.5 and n/(n+2)) collide numerically, a genuine coincidence rather than a display
 *  quirk. */
export const orderStatMaxUniform: ProbTemplate = {
  id: "prob_order_stat_max_uniform",
  topic: "order-statistics",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(3, 10, rng);
    const correct = n / (n + 1);

    return {
      tag: "prob_order_stat_max_uniform",
      prompt: `${n} independent samples are drawn from a continuous Uniform(0,1) distribution. What is the expected value of the maximum?`,
      correct,
      explanation: `The maximum of n iid Uniform(0,1) draws has CDF F(x) = x^n, so E[max] = ∫₀¹ (1 - x^n) dx = n/(n+1).`,
      distractors: [
        // Swapped max and min: E[min] = 1/(n+1).
        { value: 1 / (n + 1), reasoning: "computed E[min] instead of E[max] — swapped the two order statistics" },
        // Reported the plain mean, ignoring that it's a maximum of several draws.
        { value: 0.5, reasoning: "reported the mean of a single Uniform(0,1) draw, ignoring that this is the maximum of n draws" },
        // Off-by-one in the denominator.
        { value: n / (n + 2), reasoning: "off-by-one in the denominator — used n/(n+2) instead of n/(n+1)" },
        // Off-by-one in the numerator.
        { value: (n - 1) / n, reasoning: "off-by-one in the numerator — used (n-1)/n instead of n/(n+1)" },
      ],
    };
  },
};

/** E[max of n fair dice] = sum_{k=1}^{6} [1 - ((k-1)/6)^n], an exact finite sum. */
export const orderStatMaxDice: ProbTemplate = {
  id: "prob_order_stat_max_dice",
  topic: "order-statistics",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(2, 5, rng);
    const maxTail = (exponent: number) =>
      Array.from({ length: 6 }, (_, i) => 1 - Math.pow(i / 6, exponent)).reduce((a, b) => a + b, 0);
    const minTail = () => Array.from({ length: 6 }, (_, i) => Math.pow((6 - i) / 6, n)).reduce((a, b) => a + b, 0);
    const correct = maxTail(n);

    return {
      tag: "prob_order_stat_max_dice",
      prompt: `${n} fair six-sided dice are rolled. What is the expected value of the highest die shown?`,
      correct,
      explanation: `E[max] = Σ_{k=1}^{6} P(max ≥ k) = Σ_{k=1}^{6} [1 − ((k-1)/6)^${n}], since all ${n} dice must land below k for the max to fall short of k.`,
      distractors: [
        // Reported the mean of a single die, ignoring that this is a maximum of several dice.
        { value: 3.5, reasoning: "reported E[single die] = 3.5 instead of E[max of n dice]" },
        // Swapped max and min.
        { value: minTail(), reasoning: "computed E[min] instead of E[max] — swapped the two order statistics" },
        // Off-by-one in the number of dice used in the tail-sum formula.
        { value: n > 2 ? maxTail(n - 1) : maxTail(n + 1), reasoning: "off-by-one in the exponent of the tail-probability formula" },
        // Used the continuous-uniform analogue instead of accounting for the six discrete faces.
        { value: 1 + (n / (n + 1)) * 5, reasoning: "used the continuous-uniform max formula, scaled to [1,6], instead of the discrete dice formula" },
      ],
    };
  },
};
