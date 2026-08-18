import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const KINDS = ["gcd", "lcm", "euclid_step"] as const;

export const factorSprint: DrillDefinition = {
  key: "factor-sprint",
  name: "Factor Sprint",
  tagline: "Race the Euclidean algorithm.",
  domain: "number-theory",
  defaultDurationS: 90,
  inputKind: "numeric",
  rules:
    "Each problem is one of three types: gcd(a, b), lcm(a, b), or a Euclidean-algorithm remainder step — 'a ÷ b, what's left over?'. Type the number. Weak-spot mode weights toward whichever of the three you're worst at.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "90 seconds mixing GCD, LCM, and Euclidean remainder steps." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with small numbers, widens the range on a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever of GCD / LCM / remainder steps you've missed most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let kind: (typeof KINDS)[number] = pick([...KINDS], rng);
    if (biasTags?.length) {
      const eligible = KINDS.filter((k) => biasTags.includes(k));
      if (eligible.length && rng() < 0.7) kind = pick([...eligible], rng);
    }

    const hi = 12 + level * 6;
    const a = 2 + Math.floor(rng() * hi);
    const b = 2 + Math.floor(rng() * hi);
    const id = `${Date.now()}-${Math.floor(rng() * 1e6)}`;

    if (kind === "lcm") {
      const g = gcd(a, b);
      return { id, tag: "lcm", prompt: `lcm(${a}, ${b})`, answer: String((a * b) / g) };
    }
    if (kind === "euclid_step") {
      const bigger = Math.max(a, b);
      const smaller = Math.min(a, b) || 1;
      return { id, tag: "euclid_step", prompt: `Euclid step — ${bigger} ÷ ${smaller}, what's the remainder?`, answer: String(bigger % smaller) };
    }
    return { id, tag: "gcd", prompt: `gcd(${a}, ${b})`, answer: String(gcd(a, b)) };
  },
};
