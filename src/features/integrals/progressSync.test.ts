import { describe, expect, it } from "vitest";
import { mergeProgress } from "./progressSync";
import { emptyProgress, type Progress } from "./progress";

const base = (over: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...over });

describe("mergeProgress", () => {
  it("takes the higher xp rather than summing or picking a side", () => {
    const merged = mergeProgress(base({ xp: 300 }), base({ xp: 120 }));
    expect(merged.xp).toBe(300);
  });

  it("unions solves that only exist on one side", () => {
    const a = base({ solves: { p1: { solvedAt: "2026-08-01", solves: 1, bestSeconds: 40, everSolvedWithoutHints: true } } });
    const b = base({ solves: { p2: { solvedAt: "2026-08-02", solves: 1, bestSeconds: 30, everSolvedWithoutHints: false } } });
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.solves).sort()).toEqual(["p1", "p2"]);
  });

  it("keeps the better record for a solve present on both sides", () => {
    const a = base({
      solves: { p1: { solvedAt: "2026-08-01T00:00:00Z", solves: 1, bestSeconds: 40, everSolvedWithoutHints: false } },
    });
    const b = base({
      solves: { p1: { solvedAt: "2026-08-02T00:00:00Z", solves: 3, bestSeconds: 25, everSolvedWithoutHints: true } },
    });
    const merged = mergeProgress(a, b);
    expect(merged.solves.p1).toEqual({
      solvedAt: "2026-08-02T00:00:00Z", // the later timestamp
      solves: 3, // the higher count
      bestSeconds: 25, // the faster time
      everSolvedWithoutHints: true, // true beats false on either side
    });
  });

  it("never drops a solve down to a worse record", () => {
    // Order shouldn't matter — merging b into a must give the same answer as a into b.
    const a = base({
      solves: { p1: { solvedAt: "2026-08-01T00:00:00Z", solves: 5, bestSeconds: 10, everSolvedWithoutHints: true } },
    });
    const b = base({
      solves: { p1: { solvedAt: "2026-08-02T00:00:00Z", solves: 1, bestSeconds: 90, everSolvedWithoutHints: false } },
    });
    expect(mergeProgress(a, b).solves.p1).toEqual(mergeProgress(b, a).solves.p1);
    expect(mergeProgress(a, b).solves.p1.solves).toBe(5);
    expect(mergeProgress(a, b).solves.p1.bestSeconds).toBe(10);
  });

  it("prefers a solved daily over an unsolved one for the same day", () => {
    const solved: Progress["daily"][string] = {
      problemId: "p1",
      solved: true,
      seconds: 50,
      hintsUsed: 0,
      wrongAttempts: 0,
      score: 80,
    };
    const unsolved: Progress["daily"][string] = { ...solved, solved: false, score: 0 };
    const a = base({ daily: { "2026-08-20": unsolved } });
    const b = base({ daily: { "2026-08-20": solved } });
    expect(mergeProgress(a, b).daily["2026-08-20"]).toEqual(solved);
    expect(mergeProgress(b, a).daily["2026-08-20"]).toEqual(solved);
  });

  it("prefers the higher score between two solved attempts at the same daily", () => {
    const lo: Progress["daily"][string] = {
      problemId: "p1", solved: true, seconds: 90, hintsUsed: 2, wrongAttempts: 3, score: 40,
    };
    const hi: Progress["daily"][string] = {
      problemId: "p1", solved: true, seconds: 30, hintsUsed: 0, wrongAttempts: 0, score: 95,
    };
    const merged = mergeProgress(base({ daily: { "2026-08-20": lo } }), base({ daily: { "2026-08-20": hi } }));
    expect(merged.daily["2026-08-20"]).toEqual(hi);
  });

  it("takes the streak state from whichever side played more recently, and the longer of the two bests", () => {
    const a = base({ streak: { current: 2, longest: 5, lastDayKey: "2026-08-10" } });
    const b = base({ streak: { current: 9, longest: 9, lastDayKey: "2026-08-25" } });
    const merged = mergeProgress(a, b);
    expect(merged.streak).toEqual({ current: 9, longest: 9, lastDayKey: "2026-08-25" });
  });

  it("keeps the higher longest streak even from the stale side", () => {
    const a = base({ streak: { current: 1, longest: 40, lastDayKey: "2026-06-01" } });
    const b = base({ streak: { current: 3, longest: 3, lastDayKey: "2026-08-25" } });
    expect(mergeProgress(a, b).streak.longest).toBe(40);
  });

  it("treats a never-played side as neutral rather than resetting the streak", () => {
    const untouched = base();
    const played = base({ streak: { current: 4, longest: 6, lastDayKey: "2026-08-25" } });
    expect(mergeProgress(untouched, played).streak).toEqual(played.streak);
    expect(mergeProgress(played, untouched).streak).toEqual(played.streak);
  });

  it("keeps the earliest earned-at timestamp for a badge earned on both sides", () => {
    const a = base({ badges: { "first-blood": "2026-08-05T00:00:00Z" } });
    const b = base({ badges: { "first-blood": "2026-08-01T00:00:00Z" } });
    expect(mergeProgress(a, b).badges["first-blood"]).toBe("2026-08-01T00:00:00Z");
  });

  it("unions badges and lessons read across both sides", () => {
    const a = base({ badges: { "first-blood": "2026-08-01T00:00:00Z" }, lessonsRead: ["parts"] });
    const b = base({ badges: { "week-streak": "2026-08-02T00:00:00Z" }, lessonsRead: ["u-sub"] });
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.badges).sort()).toEqual(["first-blood", "week-streak"]);
    expect(merged.lessonsRead.sort()).toEqual(["parts", "u-sub"]);
  });

  it("takes the better sprint best per config, never the sum of runs", () => {
    const a = base({ sprints: { "mixed-60": { score: 80, solved: 4, runs: 3, at: "2026-08-01T00:00:00Z" } } });
    const b = base({ sprints: { "mixed-60": { score: 120, solved: 6, runs: 5, at: "2026-08-02T00:00:00Z" } } });
    const merged = mergeProgress(a, b);
    expect(merged.sprints["mixed-60"]).toEqual({ score: 120, solved: 6, runs: 5, at: "2026-08-02T00:00:00Z" });
  });

  it("is a no-op merging a snapshot with an empty one, from either side", () => {
    const played = base({
      xp: 500,
      solves: { p1: { solvedAt: "2026-08-01", solves: 1, bestSeconds: 20, everSolvedWithoutHints: true } },
      streak: { current: 3, longest: 3, lastDayKey: "2026-08-20" },
    });
    expect(mergeProgress(played, emptyProgress())).toEqual(played);
    expect(mergeProgress(emptyProgress(), played)).toEqual(played);
  });
});
