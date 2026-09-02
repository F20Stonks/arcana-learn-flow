/**
 * Fair-die templates. Verified in generate.test.ts by exhaustively enumerating the (small) finite
 * outcome space rather than sampling it — dice_sum_two_dice has 36 outcomes and
 * dice_at_least_one_target has at most 6^6, both cheap to enumerate exactly.
 */
import { randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

/** P(sum of two fair dice = s) = (6 - |s-7|) / 36. Restricted to s in [3,11] to avoid the s=2/12
 *  edge where the count is 1, which would collapse the "single ordered pair" distractor onto the
 *  correct answer. */
export const diceSumTwoDice: ProbTemplate = {
  id: "prob_dice_sum_two",
  topic: "dice",
  difficulty: 1,
  generate: (rng) => {
    const s = randInt(3, 11, rng);
    const count = 6 - Math.abs(s - 7);
    const correct = count / 36;
    return {
      tag: "prob_dice_sum_two",
      prompt: `Two fair six-sided dice are rolled. What is the probability their sum is ${s}?`,
      correct,
      isProbability: true,
      explanation: `There are ${count} of the 36 equally-likely ordered outcomes with sum ${s} (count = 6 − |sum − 7|), so P = ${count}/36.`,
      distractors: [
        // Treated all 11 possible sums (2..12) as equally likely.
        { value: 1 / 11, reasoning: "treated all 11 possible sums as equally likely" },
        // Miscounted favourable outcomes as |s-7| instead of 6-|s-7|.
        { value: Math.abs(s - 7) / 36, reasoning: "miscounted the favourable outcomes as |sum−7| instead of 6−|sum−7|" },
        // Counted only one ordered pair achieving the sum, missing the others.
        { value: 1 / 36, reasoning: "counted only one ordered pair achieving the sum, not all of them" },
        // Took the complement.
        { value: (36 - count) / 36, reasoning: "computed P(sum ≠ target) instead of P(sum = target)" },
      ],
    };
  },
};

/** P(at least one of n dice shows a value in the top m faces) = 1 - ((6-m)/6)^n. */
export const diceAtLeastOneTarget: ProbTemplate = {
  id: "prob_dice_at_least_one_target",
  topic: "dice",
  difficulty: 1,
  generate: (rng) => {
    const n = randInt(2, 6, rng);
    const m = randInt(1, 3, rng);
    const faceDescription = m === 1 ? "a 6" : m === 2 ? "a 5 or a 6" : "a 4, 5, or 6";
    const missBase = (6 - m) / 6;
    const correct = 1 - Math.pow(missBase, n);
    const offsetM = m < 3 ? m + 1 : m - 1;
    const offsetFaceDescription = offsetM === 1 ? "a 6" : offsetM === 2 ? "a 5 or a 6" : "a 4, 5, or 6";

    return {
      tag: "prob_dice_at_least_one_target",
      prompt: `${n} fair six-sided dice are rolled. What is the probability that at least one shows ${faceDescription}?`,
      correct,
      isProbability: true,
      explanation: `P(at least one) = 1 − P(none) = 1 − (${6 - m}/6)^${n}, since each die independently misses the target set with probability ${6 - m}/6.`,
      distractors: [
        { value: Math.pow(missBase, n), reasoning: "reported P(no die shows the target) instead of its complement" },
        { value: Math.pow(m / 6, n), reasoning: "computed P(all dice show the target) instead of P(at least one)" },
        { value: 1 - Math.pow(missBase, n - 1), reasoning: "off-by-one — used n−1 dice in the complement" },
        {
          value: 1 - Math.pow((6 - offsetM) / 6, n),
          reasoning: `off-by-one in the target set — used "${offsetFaceDescription}" instead of "${faceDescription}"`,
        },
      ],
    };
  },
};
