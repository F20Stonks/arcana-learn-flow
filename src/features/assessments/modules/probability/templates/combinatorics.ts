/**
 * Combinatorics: arrangements with a restriction, and selection with an at-least-one complement.
 * Verified in generate.test.ts by brute-force enumeration — both counts are small enough
 * (n! <= 8! and C(n,k) with n <= 14) to enumerate exactly rather than sample.
 */
import { randInt } from "../../../engine/rng";
import { choose, factorial } from "../format";
import type { ProbTemplate } from "./types";

/** n people in a row, two specific people (Alice and Bob) must NOT be adjacent: n! - (n-1)!*2.
 *  n starts at 5, not 4, because at n=4 the "adjacent" and "not adjacent" counts are numerically
 *  equal (12 and 12) — a genuine coincidence, not a formatting collision, so it's excluded rather
 *  than left to the retry path. */
export const comboArrangementsNonAdjacent: ProbTemplate = {
  id: "prob_combo_arrangements_non_adjacent",
  topic: "combinatorics",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(5, 8, rng);
    const total = factorial(n);
    const adjacent = factorial(n - 1) * 2;
    const correct = total - adjacent;

    return {
      tag: "prob_combo_arrangements_non_adjacent",
      prompt: `${n} people, including Alice and Bob, are arranged in a row. In how many arrangements are Alice and Bob NOT sitting next to each other?`,
      correct,
      explanation: `Treat "Alice and Bob adjacent" as a single block: (${n}-1)! ways to arrange ${n - 1} units, times 2 for Alice/Bob's internal order, giving ${adjacent} adjacent arrangements. Not-adjacent = total − adjacent = ${n}! − ${adjacent} = ${correct}.`,
      distractors: [
        // Forgot the factor of 2 for Alice/Bob's order within the block.
        { value: total - factorial(n - 1), reasoning: "forgot the two ways to order Alice and Bob within the adjacent block" },
        // Reported the "adjacent" count instead of "not adjacent".
        { value: adjacent, reasoning: "computed the adjacent-arrangements count and reported it directly instead of its complement" },
        // Off-by-one in how many free units the block leaves.
        { value: total - factorial(n - 2) * 2, reasoning: "off-by-one — treated the pair as leaving n-2 free units instead of n-1" },
        // Ignored the restriction entirely.
        { value: total, reasoning: "ignored the adjacency restriction entirely and counted all arrangements" },
      ],
    };
  },
};

/** Committees of size k from n people with at least one of a special group of size m: C(n,k) - C(n-m,k). */
export const comboSelectionAtLeastOne: ProbTemplate = {
  id: "prob_combo_selection_at_least_one",
  topic: "combinatorics",
  difficulty: 2,
  generate: (rng) => {
    const n = randInt(8, 14, rng);
    const k = randInt(3, 6, rng);
    const m = randInt(2, 5, rng);
    const total = choose(n, k);
    const noneSpecial = choose(n - m, k);
    const correct = total - noneSpecial;

    return {
      tag: "prob_combo_selection_at_least_one",
      prompt: `A committee of ${k} people is chosen from ${n} candidates, ${m} of whom are alumni. How many committees include at least one alumnus?`,
      correct,
      explanation: `Complement counting: total committees minus committees with no alumni. C(${n},${k}) − C(${n - m},${k}) = ${total} − ${noneSpecial} = ${correct}.`,
      distractors: [
        // Complement swapped — reported the "no special members" count instead of "at least one".
        { value: noneSpecial, reasoning: "computed the no-alumni count and reported it directly instead of its complement" },
        // Classic overcount: pick 1 alumnus as "the" alumnus, then fill the rest freely.
        { value: m * choose(n - 1, k - 1), reasoning: "picked one alumnus and filled the rest freely — overcounts committees with multiple alumni" },
        // Subtracted the wrong complement group (all-alumni committees instead of no-alumni).
        { value: total - choose(m, k), reasoning: "subtracted the all-alumni committee count instead of the no-alumni committee count" },
        // Ignored the restriction entirely.
        { value: total, reasoning: "ignored the at-least-one requirement and counted all committees" },
      ],
    };
  },
};
