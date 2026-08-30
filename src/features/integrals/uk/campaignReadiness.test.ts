import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  MIN_READINESS_SAMPLE,
  READINESS_WINDOW_DAYS,
} from "./campaignReadiness";
import type { AttemptRecord } from "../attempts";

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
