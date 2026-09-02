/**
 * Geometric / waiting-time distributions. Verified in generate.test.ts by simulating the flip
 * sequences directly and averaging the stopping time (or its square, for the variance template) —
 * Monte Carlo.
 */
import { pick } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

interface Rate {
  value: number;
  label: string;
}

/** p = 1/2 is deliberately excluded: at p=1/2, 1-p=1/2 too, so the "used q instead of p" distractor
 *  in geometric_HH_wait would exactly equal the correct answer — a real coincidence, not a display
 *  collision. The same value also makes E[X]=Var(X) in geometric_variance's formulas below. */
const P_VALUES: Rate[] = [
  { value: 1 / 3, label: "1/3" },
  { value: 2 / 5, label: "2/5" },
  { value: 3 / 5, label: "3/5" },
  { value: 2 / 3, label: "2/3" },
  { value: 1 / 4, label: "1/4" },
  { value: 3 / 4, label: "3/4" },
  { value: 2 / 7, label: "2/7" },
  { value: 5 / 7, label: "5/7" },
];

/** Expected flips until the first HH run: E = 1/p + 1/p^2. */
export const geometricHHWait: ProbTemplate = {
  id: "prob_geometric_hh_wait",
  topic: "geometric",
  difficulty: 3,
  generate: (rng) => {
    const p = pick(P_VALUES, rng);
    const correct = 1 / p.value + 1 / (p.value * p.value);

    return {
      tag: "prob_geometric_hh_wait",
      prompt: `A biased coin lands heads with probability ${p.label}. It is flipped repeatedly until two heads occur in a row (HH). What is the expected number of flips required?`,
      correct,
      explanation: `Let E0 be the expected remaining flips with no run started, E1 with the last flip a head. E1 = 1 + (1-p)E0, and E0 = 1 + p·E1 + (1-p)·E0, which solves to E0 = 1/p + 1/p².`,
      distractors: [
        // Forgot the "restart on tails" term — used only the second-head cost.
        { value: 1 / (p.value * p.value), reasoning: "dropped the 1/p term — only accounted for needing a second consecutive head, not the risk of restarting" },
        // Naive doubling of the simple one-head wait time.
        { value: 2 / p.value, reasoning: "naively doubled the expected wait for a single head (2/p) instead of solving the recursion" },
        // Used the expected wait for a single head only.
        { value: 1 / p.value, reasoning: "computed the expected flips to the first head only, ignoring the need for a second" },
        // Used q = 1-p in place of p.
        { value: 1 / (1 - p.value) + 1 / ((1 - p.value) * (1 - p.value)), reasoning: "used q = 1-p in place of p throughout the formula" },
      ],
    };
  },
};

/** Var(X) for X = flips to first head, X ~ Geometric(p) on {1,2,...}: Var(X) = (1-p)/p^2. */
export const geometricVariance: ProbTemplate = {
  id: "prob_geometric_variance",
  topic: "geometric",
  difficulty: 2,
  generate: (rng) => {
    const p = pick(P_VALUES, rng);
    const q = 1 - p.value;
    const correct = q / (p.value * p.value);

    return {
      tag: "prob_geometric_variance",
      prompt: `A biased coin lands heads with probability ${p.label}. Let X be the number of flips until the first head. What is Var(X)?`,
      correct,
      explanation: `For X ~ Geometric(p) on {1,2,...}, E[X] = 1/p and E[X²] = (2-p)/p², so Var(X) = E[X²] − (E[X])² = (1-p)/p².`,
      distractors: [
        // Confused E[X^2] with Var(X): reported E[X^2] directly, forgetting to subtract (E[X])^2.
        { value: (2 - p.value) / (p.value * p.value), reasoning: "computed E[X²] and reported it directly, forgetting to subtract (E[X])² to get the variance" },
        // Swapped p and q in the formula.
        { value: p.value / (q * q), reasoning: "swapped p and q — used p/(1-p)² instead of (1-p)/p²" },
        // Reported the mean instead of the variance.
        { value: 1 / p.value, reasoning: "reported E[X] instead of Var(X)" },
        // Reported the standard deviation instead of the variance.
        { value: Math.sqrt(q) / p.value, reasoning: "reported the standard deviation √Var(X) instead of the variance itself" },
      ],
    };
  },
};
