import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

interface ZetamacConfig {
  operators?: string[];
  min?: number;
  max?: number;
}

/**
 * Ranges follow the original Zetamac's shape (mul/div operands 2-12 against a 2-100 partner, so
 * division always lands on an integer) rather than reproducing its exact table — close enough for
 * the classic mode to feel like a fair comparison, with `level` widening the range for adaptive.
 */
export const zetamac: DrillDefinition = {
  key: "zetamac",
  name: "Zetamac++",
  tagline: "Mixed mental-arithmetic sprint, with a memory.",
  domain: "arithmetic",
  defaultDurationS: 120,
  inputKind: "numeric",
  rules:
    "You'll see a mixed arithmetic problem — addition, subtraction, multiplication, or division. Type the answer and submit. Division always divides evenly, so there's never a remainder to guess at. Custom rig lets you pick which operations and how large the numbers get; Adaptive widens the range as you build a streak; Weak-spot pulls extra problems from the operations you've missed most.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "120 seconds, all four operations — the direct comparison mode." },
    { id: "custom", label: "Custom rig", description: "Pick your own operators and number range." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts easy, widens the range on a streak, backs off on a miss." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights problems toward the operations you've missed most in past runs." },
  ],
  generate: ({ level, rng, biasTags, config }) => {
    const cfg = (config || {}) as ZetamacConfig;
    const operators = cfg.operators?.length ? cfg.operators : ["add", "sub", "mul", "div"];
    let op = pick(operators, rng);
    if (biasTags?.length) {
      const eligible = biasTags.filter((t) => operators.includes(t));
      if (eligible.length && rng() < 0.7) op = pick(eligible, rng);
    }

    const bump = level * 8;
    const lo = cfg.min ?? 2;
    const hiSmall = (cfg.max ?? 12) + Math.min(level * 2, 20);
    const hiBig = Math.max(lo + 1, (cfg.max ?? 100) + bump);

    let prompt: string;
    let answer: number;

    if (op === "sub") {
      const a = lo + Math.floor(rng() * (hiBig - lo));
      const b = lo + Math.floor(rng() * (a - lo + 1));
      prompt = `${a} − ${b}`;
      answer = a - b;
    } else if (op === "mul") {
      const a = 2 + Math.floor(rng() * (hiSmall - 1));
      const b = lo + Math.floor(rng() * (hiBig - lo));
      prompt = `${a} × ${b}`;
      answer = a * b;
    } else if (op === "div") {
      const a = 2 + Math.floor(rng() * (hiSmall - 1));
      const b = lo + Math.floor(rng() * (hiBig - lo));
      const product = a * b;
      prompt = `${product} ÷ ${a}`;
      answer = b;
    } else {
      op = "add";
      const a = lo + Math.floor(rng() * (hiBig - lo));
      const b = lo + Math.floor(rng() * (hiBig - lo));
      prompt = `${a} + ${b}`;
      answer = a + b;
    }

    return { id: `${Date.now()}-${Math.floor(rng() * 1e6)}`, tag: op, prompt, answer: String(answer) };
  },
};
