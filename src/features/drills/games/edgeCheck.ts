import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

/** Probability denominators kept small and "nice" — this drill is about calling the sign of the
 *  expected value fast, not doing long division, so the fraction itself should read at a glance. */
const DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];

/**
 * The trading-floor version of Probability Flash's ev-coin/ev-urn problems: instead of computing
 * the exact expected value, just call its sign — take it (EV > 0) or pass (EV < 0). Generation
 * rejects the (rare) exact-tie case rather than allow an ambiguous "correct" answer, and — when
 * weak-spot biasing toward a specific call is active — keeps resampling until that call actually
 * comes up, the same rejection-sampling shape Knot or Not already uses for its same/different bias.
 */
export const edgeCheck: DrillDefinition = {
  key: "edge-check",
  name: "Edge Check",
  tagline: "Take it or pass — pure EV sign, on instinct.",
  domain: "trading",
  defaultDurationS: 90,
  inputKind: "binary",
  binaryOptions: [
    { value: "take", label: "Take it" },
    { value: "pass", label: "Pass" },
  ],
  rules:
    "A one-shot bet: win a stated amount at a stated probability, or lose a stated amount otherwise. " +
    "Call it Take it if the expected value is positive, Pass if it's negative — pure sign judgement, " +
    "not the exact number. Weak-spot pulls extra problems from whichever call you get wrong most.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "90 seconds of take-it-or-pass calls on a bet's expected value." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever call — take or pass — you get wrong most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let wantTake: boolean | undefined;
    if (biasTags?.length && rng() < 0.7) {
      const eligible = biasTags.filter((t) => t === "take" || t === "pass");
      if (eligible.length) wantTake = pick(eligible, rng) === "take";
    }

    const hi = 10 + level * 5;
    let n = 2;
    let k = 1;
    let win = 1;
    let lose = 1;
    let evNumer = 0;
    do {
      n = pick(DENOMS, rng);
      k = 1 + Math.floor(rng() * (n - 1));
      win = 1 + Math.floor(rng() * hi);
      lose = 1 + Math.floor(rng() * hi);
      evNumer = k * win - (n - k) * lose;
    } while (evNumer === 0 || (wantTake !== undefined && evNumer > 0 !== wantTake));

    const tag = evNumer > 0 ? "take" : "pass";
    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag,
      prompt: `Win £${win} with probability ${k}/${n}, otherwise lose £${lose}. Profitable bet?`,
      answer: tag,
    };
  },
};
