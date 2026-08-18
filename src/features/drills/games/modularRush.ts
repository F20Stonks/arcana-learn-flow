import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

/**
 * Tag is `mod{n}` — one tag per modulus, not a single generic 'mod' tag — so weak-spot mode can
 * actually target "you keep messing up mod 7" rather than treating all moduli as one bucket.
 */
export const modularRush: DrillDefinition = {
  key: "modular-rush",
  name: "Modular Rush",
  tagline: "Clock arithmetic, against the clock.",
  domain: "number-theory",
  defaultDurationS: 90,
  inputKind: "numeric",
  rules:
    "You'll see 'a mod n' — the remainder when a is divided by n. Type the remainder. Moduli start small and Adaptive mode widens them as you build a streak; Weak-spot pulls extra problems from the specific moduli you've missed.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "90 seconds of a mod n, moduli from 2 up to about 20." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with small moduli, widens the range on a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights problems toward the specific moduli you've missed most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let n: number | undefined;
    if (biasTags?.length && rng() < 0.7) {
      const fromTags = biasTags
        .map((t) => Number(t.replace("mod", "")))
        .filter((v) => Number.isFinite(v) && v >= 2);
      if (fromTags.length) n = pick(fromTags, rng);
    }
    if (n === undefined) n = 2 + Math.floor(rng() * (12 + level * 3));

    const multiplier = 2 + Math.floor(rng() * (6 + level * 2));
    const a = n * multiplier + Math.floor(rng() * n);

    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag: `mod${n}`,
      prompt: `${a} mod ${n}`,
      answer: String(a % n),
    };
  },
};
