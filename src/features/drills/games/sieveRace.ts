import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

function largestPrimeFactor(n: number): number {
  let x = n;
  let largest = 1;
  for (let i = 2; i * i <= x; i++) {
    while (x % i === 0) {
      largest = i;
      x /= i;
    }
  }
  if (x > 1) largest = x;
  return largest;
}

const KINDS = ["primality", "largest_prime_factor"] as const;

/**
 * "Largest prime factor" stands in for the scoping note's "full factorization" — a single-number
 * answer keeps the shared numeric input/checker exact-match, rather than needing the player to
 * guess an expected string format (e.g. "2*2*3*7") and get marked wrong for a real answer typed
 * in the wrong order.
 */
export const sieveRace: DrillDefinition = {
  key: "sieve-race",
  name: "Sieve Race",
  tagline: "Primality and factorization, rapid-fire.",
  domain: "number-theory",
  defaultDurationS: 90,
  inputKind: "numeric",
  modes: [
    { id: "classic", label: "Classic sprint", description: "90 seconds mixing prime/not-prime calls with largest-prime-factor questions." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with small numbers, widens the range on a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights toward whichever call type you've missed most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let kind: (typeof KINDS)[number] = pick([...KINDS], rng);
    if (biasTags?.length) {
      const eligible = KINDS.filter((k) => biasTags.includes(k));
      if (eligible.length && rng() < 0.7) kind = pick([...eligible], rng);
    }

    const hi = 40 + level * 20;
    const n = 2 + Math.floor(rng() * hi);
    const id = `${Date.now()}-${Math.floor(rng() * 1e6)}`;

    if (kind === "largest_prime_factor") {
      return { id, tag: "largest_prime_factor", prompt: `Largest prime factor of ${n}`, answer: String(largestPrimeFactor(n)) };
    }
    return { id, tag: "primality", prompt: `Is ${n} prime? (1 = yes, 0 = no)`, answer: isPrime(n) ? "1" : "0" };
  },
};
