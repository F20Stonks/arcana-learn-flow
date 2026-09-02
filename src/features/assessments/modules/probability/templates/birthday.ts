/**
 * Birthday-problem collisions: the probability at least one pair matches, and (via linearity of
 * expectation) the expected number of matching pairs. Verified in generate.test.ts by simulating
 * random assignments and checking sample statistics (Monte Carlo).
 */
import { pick, randInt } from "../../../engine/rng";
import { choose } from "../format";
import type { ProbTemplate } from "./types";

interface DayOption {
  m: number;
  label: string;
}

const DAY_OPTIONS: DayOption[] = [
  { m: 12, label: "months of the year (assume births are spread uniformly across the 12 months)" },
  { m: 52, label: "weeks of the year (assume uniform)" },
  { m: 365, label: "days of the year (ignore leap years; assume uniform)" },
];

/** P(at least one shared "birthday" among n people out of m slots) = 1 - prod_{i=0}^{n-1}(1 - i/m). */
export const birthdayCollisionProb: ProbTemplate = {
  id: "prob_birthday_collision",
  topic: "birthday-problem",
  difficulty: 2,
  generate: (rng) => {
    const day = pick(DAY_OPTIONS, rng);
    const n = randInt(3, Math.min(day.m - 1, 40), rng);

    let noCollision = 1;
    for (let i = 0; i < n; i++) noCollision *= 1 - i / day.m;
    const correct = 1 - noCollision;

    let offByOne = 1;
    for (let i = 1; i <= n; i++) offByOne *= 1 - i / day.m;

    return {
      tag: "prob_birthday_collision",
      prompt: `${n} people are in a room. Assuming birthdays are uniformly distributed over the ${day.label}, what is the probability at least two of them share a "birthday"?`,
      correct,
      isProbability: true,
      explanation: `P(no shared birthday) = ∏_{i=0}^{${n - 1}} (1 − i/${day.m}), since the i-th new person must avoid the i birthdays already taken. The answer is 1 minus that product.`,
      distractors: [
        // Reported the "no collision" probability instead of its complement.
        { value: noCollision, reasoning: "reported P(no shared birthday) itself instead of its complement" },
        // The classic naive pairwise estimate that ignores overlapping events.
        { value: choose(n, 2) / day.m, reasoning: "added the probability of each pair colliding without accounting for overlap — the classic naive birthday-paradox estimate" },
        // Off-by-one: started the product at i=1 instead of i=0.
        { value: 1 - offByOne, reasoning: "off-by-one — started the no-collision product at i=1 instead of i=0" },
        // Treated it as a single person's collision chance.
        { value: n / day.m, reasoning: "treated it as a single person's collision chance instead of accounting for all pairs" },
      ],
    };
  },
};

/** E[number of colliding pairs among n people over m slots] = C(n,2) / m — linearity of expectation
 *  over the C(n,2) pair-indicator variables. */
export const birthdayExpectedPairs: ProbTemplate = {
  id: "prob_birthday_expected_pairs",
  topic: "birthday-problem",
  difficulty: 2,
  generate: (rng) => {
    const day = pick(DAY_OPTIONS, rng);
    const n = randInt(4, Math.min(day.m, 40), rng);
    const pairs = choose(n, 2);
    const correct = pairs / day.m;

    let noCollision = 1;
    for (let i = 0; i < n; i++) noCollision *= 1 - i / day.m;
    const atLeastOneCollisionProb = 1 - noCollision;

    return {
      tag: "prob_birthday_expected_pairs",
      prompt: `${n} people are in a room, with birthdays uniform over the ${day.label}. What is the expected number of pairs of people who share a "birthday"?`,
      correct,
      explanation: `By linearity of expectation, E[# matching pairs] = Σ over all C(${n},2) = ${pairs} pairs of P(that pair matches) = ${pairs} · (1/${day.m}), regardless of dependence between pairs.`,
      distractors: [
        // Confused the "at least one collision" probability with the expected count.
        { value: atLeastOneCollisionProb, reasoning: "confused P(at least one collision) with E[number of colliding pairs] — reported the birthday-paradox probability instead" },
        // Treated it as a per-person probability instead of summing over pairs.
        { value: n / day.m, reasoning: "treated it as a per-person probability instead of summing over all pairs" },
        // Used ordered pairs n(n-1) instead of unordered pairs C(n,2).
        { value: (n * (n - 1)) / day.m, reasoning: "used ordered pairs n(n-1) instead of unordered pairs C(n,2) — double-counted every pair" },
        // Multiplied by m instead of dividing.
        { value: pairs * day.m, reasoning: "multiplied the pair count by the number of slots instead of dividing by it" },
      ],
    };
  },
};
