import type { DrillDefinition } from "../types";
import { pick } from "../engine/rng";

/**
 * Scoped to cyclic groups (Z_n under addition mod n) for v1 — a correct, simple implementation
 * beats a rushed permutation-composition table for S_3/D_4. Still drills closure/identity/inverse
 * as lived arithmetic rather than memorized axioms; non-cyclic groups are a follow-up, not a gap
 * in this generator's own logic.
 */
export const cayleyFill: DrillDefinition = {
  key: "cayley-fill",
  name: "Cayley Fill",
  tagline: "Complete the table, under the clock.",
  domain: "algebra",
  defaultDurationS: 75,
  inputKind: "numeric",
  rules:
    "A small addition table for the numbers 0 to n−1, mod n, is shown with one cell blanked and highlighted. Work out row ⊕ column, mod n, and type the answer. Weak-spot mode weights toward the table size (n) you've missed most.",
  modes: [
    { id: "classic", label: "Classic sprint", description: "75 seconds filling in Z_n addition tables, n from 4 to 8." },
    { id: "adaptive", label: "Adaptive staircase", description: "Starts with a small group, widens n on a streak." },
    { id: "weak-spot", label: "Weak-spot pull", description: "Weights problems toward the group size you've missed most." },
  ],
  generate: ({ level, rng, biasTags }) => {
    let n: number | undefined;
    if (biasTags?.length && rng() < 0.7) {
      const fromTags = biasTags.map((t) => Number(t.replace("cayley_z", ""))).filter((v) => Number.isFinite(v) && v >= 3);
      if (fromTags.length) n = pick(fromTags, rng);
    }
    if (n === undefined) n = 4 + Math.min(4, Math.floor(level / 2));

    const elements = Array.from({ length: n }, (_, i) => String(i));
    const cells: (string | null)[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push(String((r + c) % n));

    const blankIdx = Math.floor(rng() * (n * n));
    const row = Math.floor(blankIdx / n);
    const col = blankIdx % n;
    const answer = cells[blankIdx]!;
    cells[blankIdx] = null;

    return {
      id: `${Date.now()}-${Math.floor(rng() * 1e6)}`,
      tag: `cayley_z${n}`,
      prompt: `${row} ⊕ ${col}, mod ${n}`,
      answer,
      visual: { kind: "cayley-table", opLabel: "⊕", elements, cells },
    };
  },
};
