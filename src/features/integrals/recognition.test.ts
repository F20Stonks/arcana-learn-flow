import { describe, expect, it } from "vitest";
import {
  assembleRound,
  distractorsFor,
  median,
  RECOGNITION_CHOICE_COUNT,
  RECOGNITION_ROUND_LENGTH,
  recognitionStatsByTechnique,
  summarize,
  type RecognitionAttempt,
} from "./recognition";
import { PROBLEMS } from "./problems";
import { confusablesFor } from "./techniqueMap";
import type { Problem, TechniqueId } from "./types";

describe("assembleRound", () => {
  it("is deterministic in its seed", () => {
    const a = assembleRound(42).map((q) => q.problem.id);
    const b = assembleRound(42).map((q) => q.problem.id);
    expect(a).toEqual(b);
  });

  it("varies across seeds", () => {
    const a = assembleRound(1).map((q) => q.problem.id);
    const b = assembleRound(2).map((q) => q.problem.id);
    expect(a).not.toEqual(b);
  });

  it("always has exactly RECOGNITION_ROUND_LENGTH questions, no repeated problems", () => {
    for (const seed of [0, 1, 7, 100, 999]) {
      const round = assembleRound(seed);
      expect(round).toHaveLength(RECOGNITION_ROUND_LENGTH);
      expect(new Set(round.map((q) => q.problem.id)).size).toBe(RECOGNITION_ROUND_LENGTH);
    }
  });

  it("gives every question exactly RECOGNITION_CHOICE_COUNT unique choices, including the correct one", () => {
    for (const seed of [3, 17, 256]) {
      for (const q of assembleRound(seed)) {
        expect(q.choices).toHaveLength(RECOGNITION_CHOICE_COUNT);
        expect(new Set(q.choices).size).toBe(RECOGNITION_CHOICE_COUNT);
        expect(q.choices).toContain(q.problem.techniques[0]);
      }
    }
  });

  it("never offers a technique already tagged on the problem as a distractor", () => {
    // Look specifically for problems tagged with more than one technique — a plain single-tag
    // problem can't expose this bug (every choice but the correct one would trivially qualify).
    const multiTagged = PROBLEMS.filter((p) => p.techniques.length > 1);
    expect(multiTagged.length).toBeGreaterThan(0); // sanity: this case actually exists in the bank

    for (const seed of [0, 5, 12, 88]) {
      for (const q of assembleRound(seed)) {
        if (q.problem.techniques.length < 2) continue;
        const wrongChoices = q.choices.filter((c) => c !== q.problem.techniques[0]);
        for (const secondaryTag of q.problem.techniques.slice(1)) {
          expect(wrongChoices).not.toContain(secondaryTag);
        }
      }
    }
  });
});

describe("median", () => {
  it("is null for an empty list", () => {
    expect(median([])).toBeNull();
  });

  it("is the middle value for an odd-length list, regardless of input order", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("is the average of the two middle values for an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles a single value", () => {
    expect(median([42])).toBe(42);
  });
});

describe("recognitionStatsByTechnique / summarize", () => {
  const attempt = (over: Partial<RecognitionAttempt> & { technique: RecognitionAttempt["technique"] }): RecognitionAttempt => ({
    id: `${over.technique}-${Math.random()}`,
    correct: true,
    responseMs: 1000,
    at: new Date().toISOString(),
    ...over,
  });

  it("computes accuracy and median response time per technique", () => {
    const attempts: RecognitionAttempt[] = [
      attempt({ technique: "power", correct: true, responseMs: 800 }),
      attempt({ technique: "power", correct: false, responseMs: 1600 }),
      attempt({ technique: "power", correct: true, responseMs: 1200 }),
      attempt({ technique: "u-sub", correct: true, responseMs: 500 }),
    ];
    const stats = recognitionStatsByTechnique(attempts);

    const power = stats.find((s) => s.technique === "power")!;
    expect(power.attempts).toBe(3);
    expect(power.correct).toBe(2);
    expect(power.accuracy).toBeCloseTo(2 / 3);
    expect(power.medianResponseMs).toBe(1200); // median of [800, 1200, 1600]

    const uSub = stats.find((s) => s.technique === "u-sub")!;
    expect(uSub.attempts).toBe(1);
    expect(uSub.accuracy).toBe(1);
  });

  it("excludes timeouts (null responseMs) from the median but still counts them as attempts", () => {
    const attempts: RecognitionAttempt[] = [
      attempt({ technique: "power", correct: false, responseMs: null }), // timeout
      attempt({ technique: "power", correct: true, responseMs: 900 }),
    ];
    const [power] = recognitionStatsByTechnique(attempts);
    expect(power.attempts).toBe(2);
    expect(power.correct).toBe(1);
    expect(power.medianResponseMs).toBe(900);
  });

  it("sorts techniques with the most attempts first", () => {
    const attempts: RecognitionAttempt[] = [
      attempt({ technique: "u-sub" }),
      attempt({ technique: "power" }),
      attempt({ technique: "power" }),
    ];
    const stats = recognitionStatsByTechnique(attempts);
    expect(stats[0].technique).toBe("power");
    expect(stats[0].attempts).toBe(2);
  });

  it("summarize rolls the whole round up alongside the per-technique breakdown", () => {
    const attempts: RecognitionAttempt[] = [
      attempt({ technique: "power", correct: true, responseMs: 700 }),
      attempt({ technique: "u-sub", correct: false, responseMs: null }),
    ];
    const s = summarize(attempts);
    expect(s.total).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.accuracy).toBe(0.5);
    expect(s.medianResponseMs).toBe(700);
    expect(s.byTechnique).toHaveLength(2);
  });

  it("returns an empty summary for no attempts, without dividing by zero", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.accuracy).toBe(0);
    expect(s.medianResponseMs).toBeNull();
    expect(s.byTechnique).toEqual([]);
  });
});

describe("distractorsFor / confusable preference (WS-11)", () => {
  // Minimal fake Problem — distractorsFor only ever reads `techniques` off it, so the rest is
  // filled with inert placeholders, same fixture style queue.test.ts already uses.
  const fakeProblem = (techniques: TechniqueId[]): Problem => ({
    id: "fake",
    kind: "indefinite",
    integrand: "x",
    integrandExpr: "x",
    answer: "x^2/2",
    answerLatex: "x^2/2",
    domain: [1, 2],
    difficulty: 3,
    techniques,
    source: { name: "original" },
    hints: [],
    steps: [],
  });

  const NEEDED = RECOGNITION_CHOICE_COUNT - 1;
  const SEEDS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];

  it("draws every distractor from confusablesFor(primary) when it has enough members to fill every slot", () => {
    // trig-sub's confusables are exactly 3 (complete-square, partial-fractions via family;
    // trig-identity via cross-link) -- exactly NEEDED, so the result should be that exact set,
    // reordered, for every seed.
    const confusables = confusablesFor("trig-sub");
    expect(confusables).toHaveLength(NEEDED);
    const problem = fakeProblem(["trig-sub"]);

    for (const seed of SEEDS) {
      const distractors = distractorsFor(problem, seed);
      expect(distractors).toHaveLength(NEEDED);
      expect(new Set(distractors)).toEqual(new Set(confusables));
    }
  });

  it("stays inside a larger confusable pool rather than spilling into unrelated techniques", () => {
    // gamma-function has 5 confusables (3 reduction-formulas siblings + 2 cross-links) -- strictly
    // more than NEEDED, so every distractor for every seed should still come from that pool of 5,
    // never a technique with no real relationship to gamma-function (e.g. floor-function).
    const confusables = new Set(confusablesFor("gamma-function"));
    expect(confusables.size).toBeGreaterThan(NEEDED);
    const problem = fakeProblem(["gamma-function"]);

    const seenSets = new Set<string>();
    for (const seed of SEEDS) {
      const distractors = distractorsFor(problem, seed);
      expect(distractors).toHaveLength(NEEDED);
      for (const d of distractors) expect(confusables.has(d)).toBe(true);
      seenSets.add([...distractors].sort().join(","));
    }
    // And it's a real preference-plus-shuffle, not one hardcoded triple every time.
    expect(seenSets.size).toBeGreaterThan(1);
  });

  it("uses every available confusable before topping up with random techniques, when there are too few to fill every slot", () => {
    // symmetry's only confusable is reciprocal-substitution (one family sibling, no cross-link) --
    // fewer than NEEDED, so it should be included every time, with the remaining slots filled from
    // outside the (nonexistent-beyond-one) confusable pool.
    const confusables = confusablesFor("symmetry");
    expect(confusables).toEqual(["reciprocal-substitution"]);
    const problem = fakeProblem(["symmetry"]);

    for (const seed of SEEDS) {
      const distractors = distractorsFor(problem, seed);
      expect(distractors).toHaveLength(NEEDED);
      expect(distractors).toContain("reciprocal-substitution");
      expect(new Set(distractors).size).toBe(NEEDED); // no duplicates introduced by the top-up
    }
  });

  it("falls back to the old fully-random behavior for a technique with no confusables at all", () => {
    // floor-function is the one technique techniqueMap.ts leaves with an empty confusablesFor.
    expect(confusablesFor("floor-function")).toEqual([]);
    const problem = fakeProblem(["floor-function"]);

    for (const seed of SEEDS) {
      const distractors = distractorsFor(problem, seed);
      expect(distractors).toHaveLength(NEEDED);
      expect(new Set(distractors).size).toBe(NEEDED);
      expect(distractors).not.toContain("floor-function");
    }
  });

  it("still never offers a distractor tagged on the problem, even when that tag is itself a confusable of the primary", () => {
    // recurrence is a genuine family sibling of gamma-function (both reduction-formulas) -- tag a
    // fake problem with both, and confirm recurrence is excluded from the preferred pool exactly
    // like any other tagged technique, not accidentally favored because it's "confusable".
    expect(confusablesFor("gamma-function")).toContain("recurrence");
    const problem = fakeProblem(["gamma-function", "recurrence"]);

    // The remaining confusables (beta-integrals, wallis-product, zeta-series,
    // gaussian-hypersphere) are still legitimately preferred over unrelated techniques.
    const eligibleConfusables = confusablesFor("gamma-function");
    for (const seed of SEEDS) {
      const distractors = distractorsFor(problem, seed);
      expect(distractors).toHaveLength(NEEDED);
      expect(distractors).not.toContain("gamma-function");
      expect(distractors).not.toContain("recurrence");
      for (const d of distractors) {
        expect(eligibleConfusables).toContain(d);
      }
    }
  });
});
