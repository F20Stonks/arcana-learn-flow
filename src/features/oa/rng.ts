/**
 * Seeded randomness.
 *
 * Every question in a run is generated from one seed, so a run is reproducible: "the set I sat on
 * Tuesday" is a number you can hand to someone else, and a failing generator is debuggable rather
 * than a ghost.
 */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  /** One element. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p. */
  chance(p: number): boolean;
}

/** mulberry32 — small, fast, and good enough for question generation. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    chance: (p) => next() < p,
  };
}
