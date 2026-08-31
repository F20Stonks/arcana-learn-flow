import { describe, expect, it } from "vitest";
import {
  applyGrade,
  bandForDifficulty,
  beatsTarget,
  clampLevel,
  HEADSOLVE_TARGET_MS,
  LEVEL_COUNT,
  SEED_TIERS,
  SUCCESS_STREAK_TO_LEVEL_UP,
  headsolveBand,
  headsolveTargetMs,
  initialLadderState,
  nextHeadsolveProblem,
  poolForLevel,
  rankedByHeadsolvability,
  statsByBand,
  statsByTechnique,
  summarizeHeadsolve,
  type HeadsolveAttempt,
  type HeadsolveGrade,
} from "./headsolve";
import { TECHNIQUES } from "./techniques";
import type { Difficulty, Problem, TechniqueId } from "./types";

// ── fixtures ───────────────────────────────────────────────────────────────────────────────────
//
// Minimal, deliberately fake Problem objects — headsolve.ts only ever reads id/difficulty/
// techniques off a Problem, so the rest is inert placeholder, same convention as queue.test.ts.

function problem(id: string, techniques: TechniqueId[], difficulty: Difficulty = 3): Problem {
  return {
    id,
    kind: "indefinite",
    integrand: "x",
    integrandExpr: "x",
    answer: "x^2/2",
    answerLatex: "x^2/2",
    domain: [1, 2],
    difficulty,
    techniques,
    source: { name: "original" },
    hints: [],
    steps: [],
  };
}

let idSeq = 0;
function headsolveAttempt(
  technique: TechniqueId,
  grade: HeadsolveGrade,
  over: Partial<HeadsolveAttempt> = {},
): HeadsolveAttempt {
  idSeq += 1;
  return {
    id: `hs-${idSeq}`,
    problemId: `problem-${idSeq}`,
    technique,
    band: "accessible",
    grade,
    thinkMs: 5000,
    beatTarget: true,
    at: new Date(2026, 7, 30).toISOString(),
    ...over,
  };
}

// ── bands and targets ─────────────────────────────────────────────────────────────────────────

describe("bandForDifficulty / headsolveBand", () => {
  it("groups 1-2 accessible, 3 mid, 4-5 tail", () => {
    expect(bandForDifficulty(1)).toBe("accessible");
    expect(bandForDifficulty(2)).toBe("accessible");
    expect(bandForDifficulty(3)).toBe("mid");
    expect(bandForDifficulty(4)).toBe("tail");
    expect(bandForDifficulty(5)).toBe("tail");
  });

  it("headsolveBand reads a problem's own difficulty", () => {
    expect(headsolveBand(problem("p", ["power"], 1))).toBe("accessible");
    expect(headsolveBand(problem("p", ["power"], 5))).toBe("tail");
  });
});

describe("HEADSOLVE_TARGET_MS / headsolveTargetMs / beatsTarget", () => {
  it("uses the runbook's own numbers — 30s accessible, 90s mid, no target for tail", () => {
    expect(HEADSOLVE_TARGET_MS.accessible).toBe(30_000);
    expect(HEADSOLVE_TARGET_MS.mid).toBe(90_000);
    expect(HEADSOLVE_TARGET_MS.tail).toBeNull();
  });

  it("headsolveTargetMs resolves via the problem's band", () => {
    expect(headsolveTargetMs(problem("p", ["power"], 2))).toBe(30_000);
    expect(headsolveTargetMs(problem("p", ["power"], 3))).toBe(90_000);
    expect(headsolveTargetMs(problem("p", ["power"], 5))).toBeNull();
  });

  it("beatsTarget is true at or under the target, false over it", () => {
    expect(beatsTarget("accessible", 29_999)).toBe(true);
    expect(beatsTarget("accessible", 30_000)).toBe(true);
    expect(beatsTarget("accessible", 30_001)).toBe(false);
    expect(beatsTarget("mid", 90_001)).toBe(false);
  });

  it("beatsTarget is null for a band with no target, whatever the time", () => {
    expect(beatsTarget("tail", 1)).toBeNull();
    expect(beatsTarget("tail", 1_000_000)).toBeNull();
  });
});

// ── the ladder ─────────────────────────────────────────────────────────────────────────────────

describe("applyGrade", () => {
  it("starts at level 0, streak 0", () => {
    expect(initialLadderState()).toEqual({ level: 0, streak: 0 });
  });

  it("builds the streak on 'got it' without levelling up before the threshold", () => {
    let state = initialLadderState();
    for (let i = 1; i < SUCCESS_STREAK_TO_LEVEL_UP; i++) {
      state = applyGrade(state, "got-it");
      expect(state.level).toBe(0);
      expect(state.streak).toBe(i);
    }
  });

  it("levels up and resets the streak once the threshold is reached", () => {
    let state = initialLadderState();
    for (let i = 0; i < SUCCESS_STREAK_TO_LEVEL_UP; i++) state = applyGrade(state, "got-it");
    expect(state).toEqual({ level: 1, streak: 0 });
  });

  it("'close' resets the streak but does not change the level", () => {
    let state = { level: 3, streak: 2 };
    state = applyGrade(state, "close");
    expect(state).toEqual({ level: 3, streak: 0 });
  });

  it("'no' drops a level and resets the streak", () => {
    let state = { level: 3, streak: 2 };
    state = applyGrade(state, "no");
    expect(state).toEqual({ level: 2, streak: 0 });
  });

  it("never drops below level 0", () => {
    let state = initialLadderState();
    state = applyGrade(state, "no");
    expect(state.level).toBe(0);
  });

  it("never rises above LEVEL_COUNT - 1", () => {
    let state = { level: LEVEL_COUNT - 1, streak: 0 };
    for (let i = 0; i < SUCCESS_STREAK_TO_LEVEL_UP; i++) state = applyGrade(state, "got-it");
    expect(state.level).toBe(LEVEL_COUNT - 1);
  });

  it("clampLevel clamps both directions", () => {
    expect(clampLevel(-5)).toBe(0);
    expect(clampLevel(LEVEL_COUNT + 5)).toBe(LEVEL_COUNT - 1);
    expect(clampLevel(2)).toBe(2);
  });
});

// ── seed tiers ─────────────────────────────────────────────────────────────────────────────────

describe("SEED_TIERS", () => {
  it("covers every real TechniqueId exactly once — no typo silently drops or duplicates one", () => {
    const seen = SEED_TIERS.flat();
    const realIds = TECHNIQUES.map((t) => t.id);
    expect(seen.length).toBe(realIds.length);
    expect(new Set(seen).size).toBe(seen.length); // no duplicates across tiers
    expect([...seen].sort()).toEqual([...realIds].sort());
  });

  it("puts symmetry alone in the fastest tier", () => {
    expect(SEED_TIERS[0]).toEqual(["symmetry"]);
  });
});

// ── headsolvability ranking ────────────────────────────────────────────────────────────────────

describe("rankedByHeadsolvability", () => {
  it("ranks a symmetry problem ahead of a heavier-bookkeeping technique at the same difficulty", () => {
    const pool = [problem("parts-1", ["parts"], 3), problem("sym-1", ["symmetry"], 3)];
    const ranked = rankedByHeadsolvability(pool, []);
    expect(ranked.map((p) => p.id)).toEqual(["sym-1", "parts-1"]);
  });

  it("within one technique, ranks lower difficulty ahead of higher", () => {
    const pool = [problem("sym-hard", ["symmetry"], 5), problem("sym-easy", ["symmetry"], 1)];
    const ranked = rankedByHeadsolvability(pool, []);
    expect(ranked.map((p) => p.id)).toEqual(["sym-easy", "sym-hard"]);
  });

  it("is a stable permutation — every input problem appears exactly once", () => {
    const pool = [
      problem("a", ["power"], 2),
      problem("b", ["parts"], 4),
      problem("c", ["symmetry"], 3),
    ];
    const ranked = rankedByHeadsolvability(pool, []);
    expect(ranked.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("real observed evidence can reorder past the seed tier — this is the 'let observed success refine it' behaviour", () => {
    // Seed order alone would put power (tier 2) well ahead of parts (tier 4). Give partial-fractions-
    // adjacent heavy technique "parts" a strong observed headsolve record and "power" a poor one, with
    // enough decisive samples to clear MIN_TECHNIQUE_SAMPLE, and confirm the ranking actually flips.
    const pool = [problem("power-1", ["power"], 3), problem("parts-1", ["parts"], 3)];
    const attempts: HeadsolveAttempt[] = [
      ...Array.from({ length: 6 }, () => headsolveAttempt("parts", "got-it")),
      ...Array.from({ length: 6 }, () => headsolveAttempt("power", "no")),
    ];

    const withoutHistory = rankedByHeadsolvability(pool, []);
    expect(withoutHistory.map((p) => p.id)).toEqual(["power-1", "parts-1"]);

    const withHistory = rankedByHeadsolvability(pool, attempts);
    expect(withHistory.map((p) => p.id)).toEqual(["parts-1", "power-1"]);
  });

  it("does not reorder on a small sample — a couple of picks is noise, not evidence", () => {
    const pool = [problem("power-1", ["power"], 3), problem("parts-1", ["parts"], 3)];
    const attempts: HeadsolveAttempt[] = [
      headsolveAttempt("parts", "got-it"),
      headsolveAttempt("power", "no"),
    ];
    const ranked = rankedByHeadsolvability(pool, attempts);
    expect(ranked.map((p) => p.id)).toEqual(["power-1", "parts-1"]);
  });

  it("excludes 'close' grades from the tier-adjustment evidence entirely", () => {
    const pool = [problem("power-1", ["power"], 3), problem("parts-1", ["parts"], 3)];
    // Six "close" grades on power is ambiguous evidence, not proof it's slow — the seed order (power
    // ahead of parts) should hold.
    const attempts: HeadsolveAttempt[] = Array.from({ length: 6 }, () =>
      headsolveAttempt("power", "close"),
    );
    const ranked = rankedByHeadsolvability(pool, attempts);
    expect(ranked.map((p) => p.id)).toEqual(["power-1", "parts-1"]);
  });
});

// ── level windows ──────────────────────────────────────────────────────────────────────────────

describe("poolForLevel", () => {
  const ranked = Array.from({ length: 24 }, (_, i) => problem(`p${i}`, ["power"], 3));

  it("returns an empty pool for an empty ranked list", () => {
    expect(poolForLevel([], 0)).toEqual([]);
  });

  it("is always non-empty for a non-empty ranked list, at every level including out-of-range ones", () => {
    for (const level of [-5, 0, 1, LEVEL_COUNT - 1, LEVEL_COUNT + 5]) {
      expect(poolForLevel(ranked, level).length).toBeGreaterThan(0);
    }
  });

  it("level 0's slice comes from the front of the ranked list, the top level's from the back", () => {
    const low = poolForLevel(ranked, 0);
    const high = poolForLevel(ranked, LEVEL_COUNT - 1);
    const lowIndices = low.map((p) => ranked.indexOf(p));
    const highIndices = high.map((p) => ranked.indexOf(p));
    expect(Math.max(...lowIndices)).toBeLessThan(Math.min(...highIndices));
  });

  it("stays non-empty even on a pool much smaller than LEVEL_COUNT", () => {
    const tiny = Array.from({ length: 3 }, (_, i) => problem(`t${i}`, ["power"], 3));
    for (let level = 0; level < LEVEL_COUNT; level++) {
      expect(poolForLevel(tiny, level).length).toBeGreaterThan(0);
    }
  });
});

// ── next-problem picking ───────────────────────────────────────────────────────────────────────

describe("nextHeadsolveProblem", () => {
  const pool = Array.from({ length: 24 }, (_, i) => problem(`p${i}`, ["power"], 3));

  it("is deterministic for the same seed", () => {
    const a = nextHeadsolveProblem(pool, 0, [], new Set(), 42);
    const b = nextHeadsolveProblem(pool, 0, [], new Set(), 42);
    expect(a?.id).toBe(b?.id);
  });

  it("returns null only for a genuinely empty pool", () => {
    expect(nextHeadsolveProblem([], 0, [], new Set(), 1)).toBeNull();
  });

  it("avoids excludeIds whenever the level's pool offers an alternative", () => {
    const level0 = poolForLevel(rankedByHeadsolvability(pool, []), 0);
    const exclude = new Set(level0.slice(0, level0.length - 1).map((p) => p.id));
    // Try several seeds — the picked problem should always be the one not excluded.
    for (let seed = 0; seed < 10; seed++) {
      const picked = nextHeadsolveProblem(pool, 0, [], exclude, seed);
      expect(picked).not.toBeNull();
      expect(exclude.has(picked!.id)).toBe(false);
    }
  });

  it("falls back to allowing a repeat when the whole level pool is excluded", () => {
    const single = [problem("only-one", ["power"], 3)];
    const picked = nextHeadsolveProblem(single, 0, [], new Set(["only-one"]), 7);
    expect(picked?.id).toBe("only-one");
  });
});

// ── stats ──────────────────────────────────────────────────────────────────────────────────────

describe("statsByTechnique", () => {
  it("tallies grades and computes successRate/medianThinkMs per technique", () => {
    const attempts: HeadsolveAttempt[] = [
      headsolveAttempt("symmetry", "got-it", { thinkMs: 4000 }),
      headsolveAttempt("symmetry", "got-it", { thinkMs: 6000 }),
      headsolveAttempt("symmetry", "no", { thinkMs: 20000 }),
      headsolveAttempt("parts", "close", { thinkMs: 50000 }),
    ];
    const stats = statsByTechnique(attempts);
    const symmetry = stats.find((s) => s.technique === "symmetry")!;
    expect(symmetry.attempts).toBe(3);
    expect(symmetry.gotIt).toBe(2);
    expect(symmetry.no).toBe(1);
    expect(symmetry.successRate).toBeCloseTo(2 / 3);
    expect(symmetry.medianThinkMs).toBe(6000);

    const parts = stats.find((s) => s.technique === "parts")!;
    expect(parts.close).toBe(1);
    expect(parts.successRate).toBe(0);
  });

  it("sorts most-attempted technique first", () => {
    const attempts: HeadsolveAttempt[] = [
      headsolveAttempt("symmetry", "got-it"),
      headsolveAttempt("parts", "got-it"),
      headsolveAttempt("parts", "no"),
    ];
    const stats = statsByTechnique(attempts);
    expect(stats[0].technique).toBe("parts");
  });

  it("is empty for an empty log", () => {
    expect(statsByTechnique([])).toEqual([]);
  });
});

describe("statsByBand / summarizeHeadsolve", () => {
  it("computes beatTargetRate only over attempts with a defined target, excluding tail", () => {
    const attempts: HeadsolveAttempt[] = [
      headsolveAttempt("power", "got-it", { band: "accessible", beatTarget: true }),
      headsolveAttempt("power", "no", { band: "accessible", beatTarget: false }),
      headsolveAttempt("parts", "got-it", { band: "tail", beatTarget: null }),
    ];
    const byBand = statsByBand(attempts);
    const accessible = byBand.find((b) => b.band === "accessible")!;
    const tail = byBand.find((b) => b.band === "tail")!;
    expect(accessible.beatTargetRate).toBeCloseTo(0.5);
    expect(tail.beatTargetRate).toBeNull();

    const summary = summarizeHeadsolve(attempts);
    expect(summary.total).toBe(3);
    expect(summary.beatTargetRate).toBeCloseTo(0.5); // tail's null attempt is excluded, same as per-band
  });

  it("summarizeHeadsolve is all-null/zero on an empty log, not a crash", () => {
    const summary = summarizeHeadsolve([]);
    expect(summary.total).toBe(0);
    expect(summary.medianThinkMs).toBeNull();
    expect(summary.beatTargetRate).toBeNull();
    expect(summary.byTechnique).toEqual([]);
    expect(summary.byBand).toHaveLength(3);
  });
});
