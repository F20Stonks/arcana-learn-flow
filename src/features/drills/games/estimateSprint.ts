import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

const KINDS = ["sqrt-round", "percent-round", "product-round", "division-round"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Fast mental estimation — the "round the inputs, then correct" skill quant tests actually grade,
 * as distinct from Zetamac's exact recall. Every format states its own rounding rule up front so
 * there's still exactly one correct answer (this drill's numeric input is integer-only, same as
 * every other numeric drill in the roster, so fuzzy/tolerance-band grading was never on the table):
 * square roots round to the nearest whole number (n is deliberately never a perfect square, so the
 * true value is irrational and can never land exactly on a rounding boundary); percentages,
 * products, and divisions round to a stated nearest unit, with generation rejecting the rare case
 * where the exact value sits precisely on a rounding tie (all checked in integer arithmetic, never
 * by comparing floating-point divisions for equality).
 */
export const estimateSprint: DrillDefinition = {
  key: "estimate-sprint",
  name: "Estimate Sprint",
  tagline: "Round smart, land exact — quick mental estimation.",
  domain: "arithmetic",
  defaultDurationS: 90,
  inputKind: "numeric",
  rules:
    "Four formats, mixed at random, each stating its own rounding rule so there's exactly one " +
    "correct answer: square roots to the nearest whole number, percentages to the nearest 10, " +
    "products to the nearest 100, and divisions to the nearest whole number. Round the inputs " +
    "first, then correct — estimate fast rather than compute exactly. Weak-spot pulls extra " +
    "problems from whichever format you've missed most.",
  modes: [
    {
      id: "classic",
      label: "Classic sprint",
      description: "90 seconds mixing square-root, percentage, product, and division estimates.",
    },
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

    if (kind === "sqrt-round") {
      const k = 3 + Math.floor(rng() * (8 + level * 4));
      const n = k * k + 1 + Math.floor(rng() * (2 * k)); // strictly between k^2 and (k+1)^2, never a perfect square
      return {
        id,
        tag: "sqrt-round",
        prompt: `$\\sqrt{${n}}$, nearest whole number?`,
        answer: String(Math.round(Math.sqrt(n))),
      };
    }

    if (kind === "percent-round") {
      let p = 0;
      let N = 0;
      do {
        p = 5 * (1 + Math.floor(rng() * 19)); // 5..95, step 5
        N = 10 * (2 + Math.floor(rng() * (20 + level * 10)));
      } while ((p * N) % 1000 === 500); // exact halfway-to-nearest-10 tie, checked in integer arithmetic
      return {
        id,
        tag: "percent-round",
        prompt: `${p}% of ${N}, nearest 10?`,
        answer: String(Math.round((p * N) / 1000) * 10),
      };
    }

    if (kind === "product-round") {
      let a = 0;
      let b = 0;
      do {
        a = 20 + Math.floor(rng() * (200 + level * 100));
        b = 20 + Math.floor(rng() * (200 + level * 100));
      } while ((a * b) % 100 === 50); // exact halfway-to-nearest-100 tie
      return {
        id,
        tag: "product-round",
        prompt: `${a} × ${b}, nearest 100?`,
        answer: String(Math.round((a * b) / 100) * 100),
      };
    }

    // division-round
    let dividend = 0;
    let divisor = 0;
    do {
      divisor = 3 + Math.floor(rng() * (15 + level * 5));
      dividend = 5 + Math.floor(rng() * (60 + level * 30));
    } while (dividend % divisor === 0 || (dividend % divisor) * 2 === divisor);
    return {
      id,
      tag: "division-round",
      prompt: `${dividend} ÷ ${divisor}, nearest whole number?`,
      answer: String(Math.round(dividend / divisor)),
    };
  },
};
