import { beforeEach, describe, expect, it } from "vitest";
import {
  BADGE_BY_ID,
  getProgress,
  liveStreak,
  nextStreak,
  recordDaily,
  recordTrainingSolve,
  resetProgress,
  stats,
  techniqueMastery,
} from "./progress";
import { PROBLEMS } from "./problems";
import { levelForXp, levelState, scoreAttempt, xpForLevel } from "./scoring";

const solveFacts = (problemId: string, over: Partial<Parameters<typeof recordTrainingSolve>[0]> = {}) => ({
  problemId,
  seconds: 45,
  hintsUsed: 0,
  wrongAttempts: 0,
  xp: 100,
  score: 100,
  ...over,
});

beforeEach(() => resetProgress());

describe("streak arithmetic", () => {
  it("extends across consecutive days", () => {
    let s = nextStreak({ current: 0, longest: 0, lastDayKey: null }, "2026-08-24");
    expect(s.current).toBe(1);
    s = nextStreak(s, "2026-08-25");
    expect(s.current).toBe(2);
  });

  it("is idempotent within a day", () => {
    const a = nextStreak({ current: 3, longest: 3, lastDayKey: "2026-08-25" }, "2026-08-25");
    expect(a.current).toBe(3);
  });

  it("resets after a gap", () => {
    const s = nextStreak({ current: 9, longest: 9, lastDayKey: "2026-08-20" }, "2026-08-25");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(9);
  });

  it("crosses a month boundary", () => {
    const s = nextStreak({ current: 4, longest: 4, lastDayKey: "2026-08-31" }, "2026-09-01");
    expect(s.current).toBe(5);
  });

  it("shows a stale streak as broken without waiting for a write", () => {
    const p = { ...getProgress(), streak: { current: 6, longest: 6, lastDayKey: "2026-08-20" } };
    expect(liveStreak(p, "2026-08-26")).toBe(0);
    expect(liveStreak(p, "2026-08-21")).toBe(6);
  });
});

describe("recording", () => {
  it("banks XP and the personal best", () => {
    recordTrainingSolve(solveFacts("power-monomial", { seconds: 40 }));
    recordTrainingSolve(solveFacts("power-monomial", { seconds: 12 }));
    const p = getProgress();
    expect(p.xp).toBe(200);
    expect(p.solves["power-monomial"].solves).toBe(2);
    expect(p.solves["power-monomial"].bestSeconds).toBe(12);
  });

  it("advances the streak on a solved daily", () => {
    const r1 = recordDaily({ ...solveFacts("power-monomial"), solved: true }, new Date(2026, 7, 24, 12));
    expect(r1.streak).toBe(1);
    const r2 = recordDaily({ ...solveFacts("power-polynomial"), solved: true }, new Date(2026, 7, 25, 12));
    expect(r2.streak).toBe(2);
  });

  it("records a failed daily without touching the streak or XP", () => {
    recordDaily({ ...solveFacts("power-monomial"), solved: false }, new Date(2026, 7, 24, 12));
    const p = getProgress();
    expect(p.xp).toBe(0);
    expect(p.streak.current).toBe(0);
    expect(p.daily["2026-08-24"].solved).toBe(false);
  });

  it("keeps one record per day", () => {
    const d = new Date(2026, 7, 24, 12);
    recordDaily({ ...solveFacts("power-monomial"), solved: false }, d);
    recordDaily({ ...solveFacts("power-monomial"), solved: true }, d);
    expect(Object.keys(getProgress().daily)).toHaveLength(1);
    expect(getProgress().daily["2026-08-24"].solved).toBe(true);
  });
});

describe("badges", () => {
  it("awards first blood on the first solve", () => {
    expect(getProgress().badges["first-blood"]).toBeUndefined();
    recordTrainingSolve(solveFacts("power-monomial"));
    expect(getProgress().badges["first-blood"]).toBeTruthy();
  });

  it("awards speed demon only under twenty seconds", () => {
    recordTrainingSolve(solveFacts("power-monomial", { seconds: 25 }));
    expect(getProgress().badges["speed-demon"]).toBeUndefined();
    recordTrainingSolve(solveFacts("power-polynomial", { seconds: 9 }));
    expect(getProgress().badges["speed-demon"]).toBeTruthy();
  });

  it("awards technique mastery when the pool is cleared", () => {
    const pool = PROBLEMS.filter((p) => p.techniques.includes("symmetry"));
    for (const p of pool) recordTrainingSolve(solveFacts(p.id));
    expect(getProgress().badges["master-symmetry"]).toBeTruthy();
    expect(BADGE_BY_ID["master-symmetry"].name).toContain("Mastery");
  });

  it("does not award mastery for an untouched technique", () => {
    expect(getProgress().badges["master-parts"]).toBeUndefined();
  });
});

describe("derived stats", () => {
  it("counts progress across the bank", () => {
    recordTrainingSolve(solveFacts("power-monomial"));
    const s = stats(getProgress(), new Date(2026, 7, 26, 12));
    expect(s.solvedCount).toBe(1);
    expect(s.totalProblems).toBe(PROBLEMS.length);
    expect(s.badges.map((b) => b.id)).toContain("first-blood");
  });

  it("counts technique mastery from solves only", () => {
    const m = techniqueMastery(getProgress(), "parts");
    expect(m.mastery).toBe(0);
    expect(m.total).toBeGreaterThan(0);
  });
});

describe("scoring", () => {
  it("pays more for harder problems", () => {
    const easy = scoreAttempt({ difficulty: 1, seconds: 30, hintsUsed: 0, wrongAttempts: 0, streak: 0, mode: "daily", repeat: false });
    const hard = scoreAttempt({ difficulty: 5, seconds: 30, hintsUsed: 0, wrongAttempts: 0, streak: 0, mode: "daily", repeat: false });
    expect(hard.total).toBeGreaterThan(easy.total);
  });

  it("pays more for speed", () => {
    const fast = scoreAttempt({ difficulty: 3, seconds: 10, hintsUsed: 0, wrongAttempts: 0, streak: 0, mode: "daily", repeat: false });
    const slow = scoreAttempt({ difficulty: 3, seconds: 400, hintsUsed: 0, wrongAttempts: 0, streak: 0, mode: "daily", repeat: false });
    expect(fast.total).toBeGreaterThan(slow.total);
  });

  it("charges for hints but never wipes the score out", () => {
    const clean = scoreAttempt({ difficulty: 3, seconds: 60, hintsUsed: 0, wrongAttempts: 0, streak: 0, mode: "daily", repeat: false });
    const helped = scoreAttempt({ difficulty: 3, seconds: 60, hintsUsed: 5, wrongAttempts: 9, streak: 0, mode: "daily", repeat: false });
    expect(helped.total).toBeLessThan(clean.total);
    expect(helped.total).toBeGreaterThan(0);
  });

  it("multiplies by the streak, up to a cap", () => {
    const at10 = scoreAttempt({ difficulty: 3, seconds: 60, hintsUsed: 0, wrongAttempts: 0, streak: 10, mode: "daily", repeat: false });
    const at50 = scoreAttempt({ difficulty: 3, seconds: 60, hintsUsed: 0, wrongAttempts: 0, streak: 50, mode: "daily", repeat: false });
    expect(at10.streakMultiplier).toBe(1.5);
    expect(at50.streakMultiplier).toBe(1.5);
  });

  it("pays less for training and much less for a repeat", () => {
    const base = { difficulty: 3 as const, seconds: 60, hintsUsed: 0, wrongAttempts: 0, streak: 0 };
    const daily = scoreAttempt({ ...base, mode: "daily", repeat: false });
    const training = scoreAttempt({ ...base, mode: "training", repeat: false });
    const repeat = scoreAttempt({ ...base, mode: "training", repeat: true });
    expect(training.total).toBeLessThan(daily.total);
    expect(repeat.total).toBeLessThan(training.total);
  });
});

describe("levels", () => {
  it("starts at level one", () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it("needs progressively more XP per level", () => {
    const gaps = [2, 3, 4, 5].map((n) => xpForLevel(n) - xpForLevel(n - 1));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });

  it("reports a sane bar position", () => {
    const s = levelState(xpForLevel(4) + 10);
    expect(s.level).toBe(4);
    expect(s.progress).toBeGreaterThan(0);
    expect(s.progress).toBeLessThan(1);
    expect(s.rank).toBeTruthy();
  });
});
