import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

const KINDS = ["dice-sum", "ncr", "bayes-freq", "ev-coin", "ev-urn"] as const;
type Kind = (typeof KINDS)[number];

function diceSumCount(cmp: "eq" | "ge" | "le", target: number): number {
  let count = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const sum = a + b;
      if (cmp === "eq" ? sum === target : cmp === "ge" ? sum >= target : sum <= target) count++;
    }
  }
  return count;
}

function choose(n: number, r: number): number {
  const k = Math.min(r, n - r);
  let num = 1;
  let den = 1;
  for (let i = 0; i < k; i++) {
    num *= n - i;
    den *= i + 1;
  }
  return Math.round(num / den);
}

/**
 * Five formats covering the core "quant interview probability" toolkit: dice counting,
 * combinatorics, Bayes via natural frequencies, and expected value on a coin or urn bet. Every
 * answer is an exact integer by construction — never a rounded decimal or a fraction to guess at:
 * dice/nCr are exact counts; Bayes uses the natural-frequency trick (assume 1000 people) with
 * sensitivity/specificity chosen as k/20 so every intermediate headcount divides evenly; both EV
 * problems pick the target expected value first and derive the payout from it, rather than the
 * other way round, so the "nice" answer is baked in rather than rounded off after the fact.
 */
export const probabilityFlash: DrillDefinition = {
  key: "probability-flash",
  name: "Probability Flash",
  tagline: "Dice, combinatorics, Bayes, and EV — on the clock.",
  domain: "probability",
  defaultDurationS: 120,
  inputKind: "numeric",
  rules:
    "Five formats, mixed at random: two-dice sums (how many of the 36 outcomes hit a target), " +
    "nCr combinatorics, Bayes' theorem as natural frequencies (out of everyone testing positive, " +
    "how many actually have it), and expected value for a coin bet or an urn bet, in pounds. Every " +
    "answer is an exact whole number by construction, positive or negative — never a fraction or a " +
    "rounded decimal to guess at. Weak-spot pulls extra problems from whichever format you've missed.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "120 seconds mixing dice, nCr, Bayes, and EV problems." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts simple, widens the numbers as you build a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights problems toward the format you've missed most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let kind: Kind = pick([...KINDS], rng);
    if (biasTags?.length) {
      const eligible = KINDS.filter((k) => biasTags.includes(k));
      if (eligible.length && rng() < 0.7) kind = pick([...eligible], rng);
    }

    const id = `${Date.now()}-${Math.floor(rng() * 1e6)}`;

    if (kind === "dice-sum") {
      const cmp = pick(["eq", "ge", "le"] as ("eq" | "ge" | "le")[], rng);
      const target = 2 + Math.floor(rng() * 11);
      const count = diceSumCount(cmp, target);
      const phrase =
        cmp === "eq" ? `sum to exactly ${target}` : cmp === "ge" ? `sum to at least ${target}` : `sum to at most ${target}`;
      return {
        id,
        tag: "dice-sum",
        prompt: `Two fair dice — how many of the 36 outcomes ${phrase}?`,
        answer: String(count),
      };
    }

    if (kind === "ncr") {
      const n = 4 + Math.floor(rng() * (6 + level * 2));
      const r = 1 + Math.floor(rng() * Math.min(n - 1, 6));
      return {
        id,
        tag: "ncr",
        prompt: `Ways to choose ${r} items from ${n}? ($\\binom{${n}}{${r}}$)`,
        answer: String(choose(n, r)),
      };
    }

    if (kind === "bayes-freq") {
      const mMax = Math.min(10 + level * 4, 40);
      const affected = 20 * (1 + Math.floor(rng() * mMax));
      const healthy = 1000 - affected;
      const sensK = 1 + Math.floor(rng() * 19);
      const specJ = 1 + Math.floor(rng() * 19);
      const truePos = (affected * sensK) / 20;
      const trueNeg = (healthy * specJ) / 20;
      const totalPos = truePos + (healthy - trueNeg);
      return {
        id,
        tag: "bayes-freq",
        prompt:
          `1000 people; ${affected} have it. Test flags ${sensK * 5}% of true cases, clears ${specJ * 5}% ` +
          `of clean ones. Of the ${totalPos} testing positive, how many actually have it?`,
        answer: String(truePos),
      };
    }

    if (kind === "ev-coin") {
      const range = 5 + level * 3;
      const ev0 = Math.floor(rng() * (2 * range + 1)) - range;
      const mag = Math.abs(ev0) + 1 + Math.floor(rng() * (10 + level * 5));
      const win = mag + ev0;
      const lose = mag - ev0;
      return {
        id,
        tag: "ev-coin",
        prompt: `Fair coin — heads win £${win}, tails lose £${lose}. Expected value in £?`,
        answer: String(ev0),
      };
    }

    // ev-urn
    const winners = 1 + Math.floor(rng() * (6 + level * 2));
    const oddsMult = 2 + Math.floor(rng() * 5);
    const totalBalls = winners * oddsMult;
    const targetEv = 1 + Math.floor(rng() * (10 + level * 5));
    const payout = oddsMult * targetEv;
    return {
      id,
      tag: "ev-urn",
      prompt: `Urn of ${totalBalls} balls: ${winners} pay £${payout} each, rest pay £0. Expected value in £?`,
      answer: String(targetEv),
    };
  },
};
