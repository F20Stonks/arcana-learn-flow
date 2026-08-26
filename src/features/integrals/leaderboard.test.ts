import { beforeEach, describe, expect, it } from "vitest";
import {
  boardWindow,
  ordinal,
  percentileAmong,
  rememberSubmitted,
  submittedPuzzles,
  type LeaderboardRow,
} from "./leaderboard";

const row = (rank: number, score: number, userId = `u${rank}`): LeaderboardRow => ({
  userId,
  displayName: `Player ${rank}`,
  avatarUrl: null,
  score,
  seconds: 60,
  hintsUsed: 0,
  wrongAttempts: 0,
  rank,
});

beforeEach(() => window.localStorage.clear());

describe("ordinal", () => {
  it("handles the ordinary cases", () => {
    expect([1, 2, 3, 4, 21, 22, 23, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "21st", "22nd", "23rd", "101st",
    ]);
  });

  it("handles the teens, which break the pattern", () => {
    expect([11, 12, 13, 111, 112, 113].map(ordinal)).toEqual([
      "11th", "12th", "13th", "111th", "112th", "113th",
    ]);
  });
});

describe("percentileAmong", () => {
  const rows = [row(1, 300), row(2, 200), row(3, 100), row(4, 50), row(5, 10)];

  it("reports the share of other solvers beaten", () => {
    expect(percentileAmong(300, rows)).toBe(100);
    expect(percentileAmong(100, rows)).toBe(50);
    expect(percentileAmong(10, rows)).toBe(0);
  });

  it("claims nothing on a board of one", () => {
    // Beating nobody is the honest reading; 100% for a solo player is not.
    expect(percentileAmong(300, [row(1, 300)])).toBe(0);
    expect(percentileAmong(300, [])).toBe(0);
  });

  it("does not count a tie as a win", () => {
    const tied = [row(1, 100, "a"), row(1, 100, "b"), row(1, 100, "c")];
    expect(percentileAmong(100, tied)).toBe(0);
  });
});

describe("boardWindow", () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i + 1, 500 - i * 10));

  it("shows the podium when nobody is signed in", () => {
    const view = boardWindow(rows, null);
    expect(view.top.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(view.around).toEqual([]);
    expect(view.you).toBeNull();
  });

  it("does not repeat you in the neighbourhood when you are on the podium", () => {
    const view = boardWindow(rows, "u2");
    expect(view.you?.rank).toBe(2);
    expect(view.around).toEqual([]);
  });

  it("shows the rows either side of you when you are further down", () => {
    const view = boardWindow(rows, "u12");
    expect(view.top.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(view.around.map((r) => r.rank)).toEqual([10, 11, 12, 13, 14]);
    expect(view.you?.rank).toBe(12);
  });

  it("never overlaps the podium with the neighbourhood", () => {
    const view = boardWindow(rows, "u5");
    expect(view.around.map((r) => r.rank)).toEqual([4, 5, 6, 7]);
    const ranks = new Set([...view.top, ...view.around].map((r) => r.rank));
    expect(ranks.size).toBe(view.top.length + view.around.length);
  });

  it("clips at the bottom of the board", () => {
    const view = boardWindow(rows, "u20");
    expect(view.around.map((r) => r.rank)).toEqual([18, 19, 20]);
  });

  it("copes with a board that does not contain you", () => {
    const view = boardWindow(rows, "stranger");
    expect(view.you).toBeNull();
    expect(view.around).toEqual([]);
  });
});

describe("submission bookkeeping", () => {
  it("remembers puzzles without duplicating them", () => {
    rememberSubmitted(238);
    rememberSubmitted(238);
    rememberSubmitted(239);
    expect(submittedPuzzles()).toEqual([238, 239]);
  });

  it("survives junk in storage", () => {
    window.localStorage.setItem("arcana.integrals.submitted.v1", "not json");
    expect(submittedPuzzles()).toEqual([]);
    rememberSubmitted(1);
    expect(submittedPuzzles()).toEqual([1]);
  });

  it("keeps the list bounded", () => {
    for (let i = 1; i <= 120; i++) rememberSubmitted(i);
    const stored = submittedPuzzles();
    expect(stored).toHaveLength(90);
    expect(stored.at(-1)).toBe(120);
  });
});
