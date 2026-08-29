import { describe, expect, it } from "vitest";
import {
  assembleRound,
  median,
  RECOGNITION_CHOICE_COUNT,
  RECOGNITION_ROUND_LENGTH,
  recognitionStatsByTechnique,
  summarize,
  type RecognitionAttempt,
} from "./recognition";
import { PROBLEMS } from "./problems";

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
