/**
 * Seeded RNG.
 *
 * Every item in a run is pre-generated from one seed, which buys three things at once: back
 * navigation shows the same item it showed before, a run is reproducible from its seed alone (so
 * a bug report is a number), and the generator self-grading tests can pin a paper and assert on it.
 *
 * Generators must never reach for Math.random directly — they take `rng` from GenerateArgs.
 */

/** mulberry32 — small, fast, and good enough for question generation. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Inclusive on both ends. */
export function randInt(lo: number, hi: number, rng: () => number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Weighted pick over a { key: weight } map. Zero and negative weights are treated as absent, so a
 * profile can switch an operation off by setting it to 0 rather than deleting the key.
 */
export function weightedPick<K extends string>(weights: Record<K, number>, rng: () => number): K {
  const entries = (Object.entries(weights) as [K, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Fisher-Yates against a seeded rng. Returns a new array. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
