import { beforeEach, describe, expect, it } from "vitest";
import { BANDS, BAND_BY_ID, buildQueue, configKey, describeConfig, SKIP_PENALTY, sprintRate, sprintScore } from "./sprint";
import { PROBLEMS } from "./problems";
import { getProgress, recordSprint, resetProgress, sprintBest, totalSprints } from "./progress";

const config = { band: "mixed", seconds: 180 } as const;

beforeEach(() => resetProgress());

describe("bands", () => {
  it("lists contiguous difficulties, so a band can be summarised as a range", () => {
    for (const band of BANDS) {
      for (let i = 1; i < band.difficulties.length; i++) {
        expect(band.difficulties[i]).toBe(band.difficulties[i - 1] + 1);
      }
    }
  });

  it("cover the whole difficulty range between them", () => {
    const covered = new Set(BANDS.flatMap((b) => b.difficulties));
    expect([...covered].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("draws only from its own band", () => {
    for (const band of BANDS) {
      const queue = buildQueue({ band: band.id, seconds: 60 }, 1);
      expect(queue.length).toBeGreaterThan(10);
      for (const p of queue) expect(band.difficulties).toContain(p.difficulty);
    }
  });

  it("gives every band more problems than anyone could finish in five minutes", () => {
    for (const band of BANDS) {
      expect(buildQueue({ band: band.id, seconds: 300 }, 1).length).toBeGreaterThanOrEqual(24);
    }
  });

  it("is deterministic in its seed and varies across seeds", () => {
    const a = buildQueue(config, 7).map((p) => p.id);
    const b = buildQueue(config, 7).map((p) => p.id);
    const c = buildQueue(config, 8).map((p) => p.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("uses the whole pool rather than a slice of it", () => {
    const pool = PROBLEMS.filter((p) => BAND_BY_ID.mixed.difficulties.includes(p.difficulty));
    expect(buildQueue(config, 3)).toHaveLength(pool.length);
  });
});

describe("scoring", () => {
  const at = (difficulty: 1 | 2 | 3 | 4 | 5) =>
    PROBLEMS.find((p) => p.difficulty === difficulty)!;

  it("pays more for harder problems", () => {
    expect(sprintScore([at(5)], 0)).toBeGreaterThan(sprintScore([at(1)], 0));
  });

  it("charges for a skip", () => {
    expect(sprintScore([at(3)], 1)).toBe(sprintScore([at(3)], 0) - SKIP_PENALTY);
  });

  it("never goes negative", () => {
    expect(sprintScore([], 50)).toBe(0);
  });

  it("reports a rate that makes runs of different lengths comparable", () => {
    const short = { solved: [at(3)], skipped: 0, wrongAttempts: 0, score: 70, config: { band: "mixed", seconds: 60 } as const };
    const long = { solved: [at(3)], skipped: 0, wrongAttempts: 0, score: 70, config: { band: "mixed", seconds: 300 } as const };
    expect(sprintRate(short)).toBe(70);
    expect(sprintRate(long)).toBe(14);
  });
});

describe("personal bests", () => {
  it("keeps one per configuration", () => {
    recordSprint({ band: "mixed", seconds: 180 }, { score: 120, solved: 4 });
    recordSprint({ band: "mixed", seconds: 60 }, { score: 40, solved: 2 });
    const p = getProgress();
    expect(sprintBest(p, { band: "mixed", seconds: 180 })?.score).toBe(120);
    expect(sprintBest(p, { band: "mixed", seconds: 60 })?.score).toBe(40);
    expect(sprintBest(p, { band: "brutal", seconds: 60 })).toBeUndefined();
  });

  it("only moves the best upwards, but counts every run", () => {
    recordSprint(config, { score: 120, solved: 4 });
    const second = recordSprint(config, { score: 90, solved: 3 });
    expect(second.best.score).toBe(120);
    expect(second.best.runs).toBe(2);
    expect(second.beatenBy).toBeNull();

    const third = recordSprint(config, { score: 150, solved: 5 });
    expect(third.best.score).toBe(150);
    expect(third.beatenBy).toBe(30);
    expect(totalSprints(getProgress())).toBe(3);
  });

  it("awards the sprint badges at the stated thresholds", () => {
    for (let i = 0; i < 9; i++) recordSprint(config, { score: 10, solved: 1 });
    expect(getProgress().badges["sprinter"]).toBeUndefined();
    recordSprint(config, { score: 10, solved: 1 });
    expect(getProgress().badges["sprinter"]).toBeTruthy();

    expect(getProgress().badges["blitz"]).toBeUndefined();
    recordSprint({ band: "warmup", seconds: 60 }, { score: 150, solved: 9 });
    expect(getProgress().badges["blitz"]).toBeTruthy();
  });
});

describe("labels", () => {
  it("keys and describes a configuration unambiguously", () => {
    expect(configKey({ band: "brutal", seconds: 300 })).toBe("brutal-300");
    expect(describeConfig({ band: "brutal", seconds: 300 })).toBe("Brutal · 5 min");
  });
});
