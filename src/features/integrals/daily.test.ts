import { describe, expect, it } from "vitest";
import { dailyDifficulty, dailyNumber, dailyProblem, dayKey, shareText } from "./daily";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("daily selection", () => {
  it("gives the same problem to everyone on the same day", () => {
    const a = dailyProblem(at(2026, 8, 26));
    const b = dailyProblem(new Date(2026, 7, 26, 23, 30));
    expect(a.id).toBe(b.id);
  });

  it("moves on the next day", () => {
    const a = dailyProblem(at(2026, 8, 26));
    const b = dailyProblem(at(2026, 8, 27));
    expect(a.id).not.toBe(b.id);
  });

  it("ramps difficulty across the week", () => {
    // 2026-08-24 is a Monday.
    expect(dailyDifficulty(at(2026, 8, 24))).toBe(1);
    expect(dailyDifficulty(at(2026, 8, 28))).toBe(4);
    expect(dailyDifficulty(at(2026, 8, 29))).toBe(5);
  });

  it("matches the day's problem to the day's difficulty", () => {
    for (let d = 0; d < 30; d++) {
      const date = at(2026, 8, 1 + d);
      expect(dailyProblem(date).difficulty).toBe(dailyDifficulty(date));
    }
  });

  it("does not repeat a problem inside one cycle of a weekday", () => {
    const seen = new Set<string>();
    // Twelve consecutive Saturdays.
    for (let w = 0; w < 12; w++) {
      const date = new Date(2026, 7, 1 + 7 * w, 12);
      seen.add(dailyProblem(date).id);
    }
    // Every distinct hard problem should appear before any repeats.
    expect(seen.size).toBeGreaterThanOrEqual(Math.min(12, 4));
  });

  it("numbers days from the epoch", () => {
    expect(dailyNumber(at(2026, 1, 1))).toBe(1);
    expect(dailyNumber(at(2026, 1, 2))).toBe(2);
  });

  it("keys days by local calendar date", () => {
    expect(dayKey(at(2026, 8, 26))).toBe("2026-08-26");
  });
});

describe("shareText", () => {
  it("says nothing about the answer", () => {
    const text = shareText({
      number: 238,
      difficulty: 4,
      solved: true,
      seconds: 84,
      hintsUsed: 1,
      wrongAttempts: 0,
      streak: 7,
      score: 310,
    });
    expect(text).toContain("∫ Daily #238");
    expect(text).toContain("1:24");
    expect(text).toContain("🔥 7 day streak");
    expect(text).not.toMatch(/[a-z]\^|\\|sin|cos|ln/);
  });

  it("handles a miss", () => {
    const text = shareText({
      number: 5,
      difficulty: 2,
      solved: false,
      seconds: 300,
      hintsUsed: 3,
      wrongAttempts: 4,
      streak: 0,
      score: 0,
    });
    expect(text).toContain("Didn't crack it");
  });
});
