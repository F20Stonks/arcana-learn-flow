/**
 * A small absorbing Markov chain, distinct from gambler's ruin: two transient states, two
 * absorbing states, and a real self-loop (so the answer needs solving a linear system, not just
 * reading off one step). States: S (start) -> A w.p. a, -> B w.p. b, -> T w.p. 1-a-b.
 * T -> A w.p. c, -> B w.p. e, -> T w.p. 1-c-e (self-loop). Verified in generate.test.ts by
 * simulating the chain many times and checking the sample fraction absorbed at A (Monte Carlo).
 */
import { randInt } from "../../../engine/rng";
import type { ProbTemplate } from "./types";

export const markovAbsorption: ProbTemplate = {
  id: "prob_markov_absorption",
  topic: "markov-chains",
  difficulty: 3,
  generate: (rng) => {
    // Tenths, so every probability is a clean fraction and every branch sums to at most 1.
    const aTen = randInt(1, 4, rng);
    const bTen = randInt(1, 8 - aTen, rng);
    const cTen = randInt(1, 4, rng);
    const eTen = randInt(1, 8 - cTen, rng);
    const a = aTen / 10;
    const b = bTen / 10;
    const c = cTen / 10;
    const e = eTen / 10;

    // y = P(absorbed at A | currently at T), solving y = c + (1-c-e)*y.
    const y = c / (c + e);
    // x = P(absorbed at A | currently at S).
    const correct = a + (1 - a - b) * y;

    return {
      tag: "prob_markov_absorption",
      prompt: `A process starts in state S. Each step, from S it moves to absorbing state A with probability ${a}, to absorbing state B with probability ${b}, and otherwise to transient state T. From T, it moves to A with probability ${c}, to B with probability ${e}, and otherwise stays at T. What is the probability the process is eventually absorbed at A?`,
      correct,
      isProbability: true,
      explanation: `Let y = P(absorbed at A | at T). Since T can loop back to itself, y = c + (1-c-e)·y solves to y = c/(c+e) = ${c}/(${c}+${e}). Then P(absorbed at A | at S) = a + (1-a-b)·y = ${a} + (1-${a}-${b})·${y.toFixed(4)}.`,
      distractors: [
        // Forgot the self-loop — used the one-step probability c instead of solving c/(c+e).
        { value: a + (1 - a - b) * c, reasoning: "forgot to condition on eventual absorption from T — used the one-step probability c instead of solving y = c/(c+e)" },
        // Assumed T always eventually reaches A (treated y = 1), ignoring B entirely.
        { value: 1 - b, reasoning: "assumed the chain always eventually reaches A from T, ignoring the possibility of reaching B" },
        // Swapped a and b — used b as the direct-to-A probability from S.
        { value: b + (1 - a - b) * y, reasoning: "swapped a and b — used the probability of going directly to B as if it were the probability of going to A" },
        // Renormalized only the direct S-transitions, ignoring the path through T entirely.
        { value: a / (a + b), reasoning: "renormalized only the direct transitions from S, ignoring the possibility of passing through T" },
      ],
    };
  },
};
