import { describe, expect, it } from "vitest";
import {
  computePaperReadiness,
  computeReadiness,
  MIN_READINESS_SAMPLE,
  READINESS_WINDOW_DAYS,
} from "./campaignReadiness";
import type { AttemptRecord } from "../attempts";
import type { PaperBandResult, PaperResult } from "./paperHistory";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

let seq = 0;
function mk(overrides: Partial<AttemptRecord> & { at: string }): AttemptRecord {
  seq += 1;
  return {
    id: `attempt-${seq}`,
    problemId: "p1",
    mode: "training",
    verdictClass: "correct",
    submitted: "x",
    hintsOpen: 0,
    wrongAttemptsSoFar: 0,
    msToFirstKeystroke: 1000,
    msFirstKeystrokeToSubmit: 2000,
    ...overrides,
  };
}

describe("computeReadiness — not enough data", () => {
  it("is all null with no attempts at all", () => {
    const r = computeReadiness([], NOW);
    expect(r.attemptsInWindow).toBe(0);
    expect(r.attemptRate).toBeNull();
    expect(r.medianRecognitionSeconds).toBeNull();
    expect(r.errorRate).toBeNull();
  });

  it("stays null below MIN_READINESS_SAMPLE even with some real attempts", () => {
    const attempts = Array.from({ length: MIN_READINESS_SAMPLE - 1 }, () => mk({ at: daysAgo(1) }));
    const r = computeReadiness(attempts, NOW);
    expect(r.attemptsInWindow).toBe(MIN_READINESS_SAMPLE - 1);
    expect(r.attemptRate).toBeNull();
    expect(r.medianRecognitionSeconds).toBeNull();
    expect(r.errorRate).toBeNull();
  });

  it("gates recognition independently from rate/error — few timed samples among many attempts", () => {
    const timed = Array.from({ length: 2 }, () => mk({ at: daysAgo(1), msToFirstKeystroke: 500 }));
    const untimed = Array.from({ length: 8 }, () => mk({ at: daysAgo(1), msToFirstKeystroke: null }));
    const r = computeReadiness([...timed, ...untimed], NOW);
    expect(r.attemptsInWindow).toBe(10);
    expect(r.attemptRate).not.toBeNull(); // 10 attempts clears MIN_READINESS_SAMPLE
    expect(r.medianRecognitionSeconds).toBeNull(); // only 2 timed samples, below MIN_READINESS_SAMPLE
    expect(r.sampleSize.recognition).toBe(2);
  });
});

describe("computeReadiness — real numbers", () => {
  it("computes attempt rate as attempts-in-window over the window length", () => {
    const attempts = Array.from({ length: 7 }, () => mk({ at: daysAgo(2) }));
    const r = computeReadiness(attempts, NOW);
    expect(r.attemptsInWindow).toBe(7);
    expect(r.attemptRate).toBeCloseTo(7 / READINESS_WINDOW_DAYS, 10);
  });

  it("computes the median recognition time in seconds, odd sample count", () => {
    const ms = [1000, 5000, 3000, 2000, 4000]; // median 3000ms
    const attempts = ms.map((m) => mk({ at: daysAgo(1), msToFirstKeystroke: m }));
    const r = computeReadiness(attempts, NOW);
    expect(r.medianRecognitionSeconds).toBeCloseTo(3, 10);
  });

  it("computes the median recognition time in seconds, even sample count", () => {
    const ms = [1000, 2000, 3000, 4000, 5000, 6000]; // median of (3000,4000) = 3500ms
    const attempts = ms.map((m) => mk({ at: daysAgo(1), msToFirstKeystroke: m }));
    const r = computeReadiness(attempts, NOW);
    expect(r.medianRecognitionSeconds).toBeCloseTo(3.5, 10);
  });

  it("computes error rate as the fraction not graded correct", () => {
    const verdicts: AttemptRecord["verdictClass"][] = [
      "correct",
      "correct",
      "correct",
      "incorrect",
      "off-by-constant-factor",
      "unparseable",
    ];
    const attempts = verdicts.map((verdictClass) => mk({ at: daysAgo(1), verdictClass }));
    const r = computeReadiness(attempts, NOW);
    expect(r.errorRate).toBeCloseTo(3 / 6, 10);
  });

  it("excludes attempts outside the trailing window", () => {
    const inWindow = Array.from({ length: 5 }, () => mk({ at: daysAgo(1) }));
    const stale = Array.from({ length: 20 }, () => mk({ at: daysAgo(READINESS_WINDOW_DAYS + 1) }));
    const r = computeReadiness([...inWindow, ...stale], NOW);
    expect(r.attemptsInWindow).toBe(5);
  });

  it("includes an attempt exactly at the window boundary", () => {
    const attempts = Array.from({ length: 5 }, () => mk({ at: daysAgo(READINESS_WINDOW_DAYS) }));
    const r = computeReadiness(attempts, NOW);
    expect(r.attemptsInWindow).toBe(5);
  });
});

function band(bandId: PaperBandResult["bandId"], over: Partial<PaperBandResult> = {}): PaperBandResult {
  return { bandId, correct: 5, total: 10, secondsSpent: 900, ...over };
}

let paperSeq = 0;
function paper(over: Partial<Omit<PaperResult, "id">> = {}): PaperResult {
  paperSeq += 1;
  return {
    id: `paper-${paperSeq}`,
    seed: paperSeq,
    startedAt: "2026-09-01T09:00:00.000Z",
    finishedAt: "2026-09-01T11:00:00.000Z",
    endReason: "submitted",
    score: 18,
    total: 30,
    bands: [band("accessible"), band("solid"), band("tail")],
    triageSeconds: 600,
    secondsUsed: 7000,
    ...over,
  };
}

describe("computePaperReadiness — not enough data", () => {
  it("is all null/zero with no sittings at all", () => {
    const r = computePaperReadiness([]);
    expect(r.sittings).toBe(0);
    expect(r.accessiblePaceSeconds).toBeNull();
    expect(r.tailReachRate).toBeNull();
    expect(r.tailReachSampleSize).toBe(0);
    expect(r.scoreTrend).toBeNull();
  });

  it("has a pace from a single sitting, but no trend (nothing to compare it to)", () => {
    const r = computePaperReadiness([paper()]);
    expect(r.sittings).toBe(1);
    expect(r.accessiblePaceSeconds).not.toBeNull();
    expect(r.scoreTrend).toBeNull();
  });

  it("excludes tail reach from sittings recorded before the `attempted` field existed", () => {
    const old = paper({ bands: [band("accessible"), band("solid"), band("tail")] }); // no `attempted`
    const r = computePaperReadiness([old]);
    expect(r.tailReachRate).toBeNull();
    expect(r.tailReachSampleSize).toBe(0);
  });
});

describe("computePaperReadiness — real numbers", () => {
  it("computes accessible pace as seconds spent per question, medianed across sittings", () => {
    const p1 = paper({ bands: [band("accessible", { secondsSpent: 400, total: 10 })] }); // 40s/q
    const p2 = paper({ bands: [band("accessible", { secondsSpent: 800, total: 10 })] }); // 80s/q
    const p3 = paper({ bands: [band("accessible", { secondsSpent: 600, total: 10 })] }); // 60s/q
    const r = computePaperReadiness([p1, p2, p3]);
    expect(r.accessiblePaceSeconds).toBeCloseTo(60, 10);
  });

  it("computes tail reach as the mean fraction of the tail band actually opened", () => {
    const p1 = paper({ bands: [band("tail", { attempted: 4, total: 10 })] }); // 40%
    const p2 = paper({ bands: [band("tail", { attempted: 8, total: 10 })] }); // 80%
    const r = computePaperReadiness([p1, p2]);
    expect(r.tailReachRate).toBeCloseTo(0.6, 10);
    expect(r.tailReachSampleSize).toBe(2);
  });

  it("computes a score trend against the first sitting on record, in percentage points", () => {
    const first = paper({ score: 15, total: 30 }); // 50%
    const middle = paper({ score: 18, total: 30 }); // 60% — not the trend's endpoint
    const latest = paper({ score: 24, total: 30 }); // 80%
    const r = computePaperReadiness([first, middle, latest]);
    expect(r.scoreTrend).not.toBeNull();
    expect(r.scoreTrend?.firstScore).toBe(15);
    expect(r.scoreTrend?.latestScore).toBe(24);
    expect(r.scoreTrend?.deltaPercentagePoints).toBeCloseTo(30, 10); // 80% - 50%
  });

  it("reports a negative delta honestly when the latest sitting is worse than the first", () => {
    const first = paper({ score: 24, total: 30 });
    const latest = paper({ score: 15, total: 30 });
    const r = computePaperReadiness([first, latest]);
    expect(r.scoreTrend?.deltaPercentagePoints).toBeCloseTo(-30, 10);
  });
});
