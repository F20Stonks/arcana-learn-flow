import { beforeEach, describe, expect, it } from "vitest";
import { difficultyBreakdown, heatLevel, heatmapWeeks, historySummary, monthLabels } from "./history";
import { emptyProgress, type Progress } from "./progress";
import { PROBLEMS } from "./problems";
import { BASE_POINTS } from "./scoring";

const today = new Date(2026, 7, 26, 12); // Wednesday 26 August 2026

function withDaily(entries: Array<[string, Partial<Progress["daily"][string]>]>): Progress {
  const p = emptyProgress();
  for (const [key, record] of entries) {
    p.daily[key] = {
      problemId: "power-monomial",
      solved: true,
      seconds: 30,
      hintsUsed: 0,
      wrongAttempts: 0,
      score: 40,
      ...record,
    };
  }
  return p;
}

beforeEach(() => undefined);

describe("heat level", () => {
  const par = BASE_POINTS[1]; // power-monomial is a level-1 problem

  it("is nothing at all for a day that was missed or lost", () => {
    expect(heatLevel(undefined)).toBe(0);
    expect(heatLevel({ problemId: "power-monomial", solved: false, seconds: 9, hintsUsed: 0, wrongAttempts: 0, score: 0 })).toBe(0);
  });

  it("grades against that day's par rather than the raw score", () => {
    const day = (score: number) => ({ problemId: "power-monomial", solved: true, seconds: 9, hintsUsed: 0, wrongAttempts: 0, score });
    expect(heatLevel(day(par * 0.5))).toBe(1);
    expect(heatLevel(day(par * 0.85))).toBe(2);
    expect(heatLevel(day(par * 1.1))).toBe(3);
    expect(heatLevel(day(par * 1.4))).toBe(4);
  });

  it("gives a hard problem the same top level as an easy one for the same effort", () => {
    // The daily ramps in difficulty across the week; a perfect Monday must not look worse
    // than a scraped Saturday.
    const hard = PROBLEMS.find((p) => p.difficulty === 5)!;
    const easy = PROBLEMS.find((p) => p.difficulty === 1)!;
    const at = (id: string, score: number) => ({ problemId: id, solved: true, seconds: 9, hintsUsed: 0, wrongAttempts: 0, score });
    expect(heatLevel(at(hard.id, BASE_POINTS[5] * 1.4))).toBe(4);
    expect(heatLevel(at(easy.id, BASE_POINTS[1] * 1.4))).toBe(4);
    // ...and the same raw score means very different things on each.
    expect(heatLevel(at(hard.id, 60))).toBe(1);
    expect(heatLevel(at(easy.id, 60))).toBe(4);
  });
});

describe("the calendar grid", () => {
  it("is a rectangle of whole weeks ending on the week containing today", () => {
    const weeks = heatmapWeeks(emptyProgress(), 18, today);
    expect(weeks).toHaveLength(18);
    for (const column of weeks) expect(column).toHaveLength(7);
    expect(weeks[0][0].date.getDay()).toBe(0);
    expect(weeks.at(-1)![6].date.getDay()).toBe(6);
    expect(weeks.at(-1)!.some((c) => c.key === "2026-08-26")).toBe(true);
  });

  it("marks days after today as future, and today as not", () => {
    const weeks = heatmapWeeks(emptyProgress(), 4, today);
    const flat = weeks.flat();
    expect(flat.find((c) => c.key === "2026-08-26")!.future).toBe(false);
    expect(flat.find((c) => c.key === "2026-08-27")!.future).toBe(true);
    expect(flat.find((c) => c.key === "2026-08-25")!.future).toBe(false);
  });

  it("attaches the record for a day that was played", () => {
    const p = withDaily([["2026-08-24", { score: 55 }], ["2026-08-25", { solved: false, score: 0 }]]);
    const flat = heatmapWeeks(p, 4, today).flat();
    const solved = flat.find((c) => c.key === "2026-08-24")!;
    const missed = flat.find((c) => c.key === "2026-08-25")!;
    expect(solved.attempted).toBe(true);
    expect(solved.solved).toBe(true);
    expect(solved.level).toBeGreaterThan(0);
    expect(missed.attempted).toBe(true);
    expect(missed.solved).toBe(false);
    expect(missed.level).toBe(0);
  });

  it("drops a month label that would collide with the previous one", () => {
    const weeks = heatmapWeeks(emptyProgress(), 18, today);
    const labels = monthLabels(weeks, 3);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].index - labels[i - 1].index).toBeGreaterThanOrEqual(3);
    }
    // With no minimum gap the crowded pair reappears, which is what the gap exists to prevent.
    expect(monthLabels(weeks, 0).length).toBeGreaterThanOrEqual(labels.length);
  });

  it("labels each month once, at the column it starts in", () => {
    const labels = monthLabels(heatmapWeeks(emptyProgress(), 18, today));
    expect(labels.length).toBeGreaterThanOrEqual(4);
    expect(new Set(labels.map((l) => l.label)).size).toBe(labels.length);
    expect(labels.map((l) => l.index)).toEqual([...labels.map((l) => l.index)].sort((a, b) => a - b));
  });
});

describe("summary", () => {
  it("is all zeroes before anything is played", () => {
    const s = historySummary(emptyProgress(), today);
    expect(s).toMatchObject({ played: 0, solved: 0, bestScore: 0, bestDayKey: null, totalScore: 0 });
  });

  it("counts turnout from the first attempt, not from the epoch", () => {
    const p = withDaily([["2026-08-24", {}], ["2026-08-26", {}]]);
    const s = historySummary(p, today);
    expect(s.played).toBe(2);
    expect(s.span).toBe(3); // 24th, 25th, 26th
  });

  it("finds the best day", () => {
    const p = withDaily([["2026-08-24", { score: 40 }], ["2026-08-25", { score: 210 }]]);
    const s = historySummary(p, today);
    expect(s.bestScore).toBe(210);
    expect(s.bestDayKey).toBe("2026-08-25");
    expect(s.totalScore).toBe(250);
  });

  it("does not count an unsolved day as solved", () => {
    const p = withDaily([["2026-08-24", { solved: false, score: 0 }]]);
    expect(historySummary(p, today).solved).toBe(0);
    expect(historySummary(p, today).played).toBe(1);
  });
});

describe("difficulty breakdown", () => {
  it("covers all five levels and totals the whole bank", () => {
    const rows = difficultyBreakdown(emptyProgress());
    expect(rows.map((r) => r.difficulty)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(PROBLEMS.length);
    expect(rows.every((r) => r.solved === 0)).toBe(true);
  });

  it("counts a solve against its own level only", () => {
    const p = emptyProgress();
    const target = PROBLEMS.find((q) => q.difficulty === 3)!;
    p.solves[target.id] = { solvedAt: "", solves: 1, bestSeconds: 10, everSolvedWithoutHints: true };
    const rows = difficultyBreakdown(p);
    expect(rows.find((r) => r.difficulty === 3)!.solved).toBe(1);
    expect(rows.filter((r) => r.difficulty !== 3).every((r) => r.solved === 0)).toBe(true);
  });
});
