import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPaperSnapshot,
  getPaperHistory,
  getPaperSnapshot,
  paperResultForSeed,
  recordPaperResult,
  resetPaperHistory,
  savePaperSnapshot,
  type PaperResult,
  type PaperRunSnapshot,
} from "./paperHistory";
import { setProgressScope } from "../progress";

const result = (over: Partial<Omit<PaperResult, "id">> = {}): Omit<PaperResult, "id"> => ({
  seed: 1,
  startedAt: "2026-09-01T09:00:00.000Z",
  finishedAt: "2026-09-01T11:00:00.000Z",
  endReason: "submitted",
  score: 18,
  total: 30,
  bands: [
    { bandId: "accessible", correct: 9, total: 10, secondsSpent: 900 },
    { bandId: "solid", correct: 6, total: 10, secondsSpent: 2400 },
    { bandId: "tail", correct: 3, total: 10, secondsSpent: 3900 },
  ],
  triageSeconds: 1800,
  secondsUsed: 7200,
  ...over,
});

const snapshot = (over: Partial<PaperRunSnapshot> = {}): PaperRunSnapshot => ({
  seed: 1,
  startedAt: "2026-09-01T09:00:00.000Z",
  remainingSeconds: 5400,
  paused: false,
  currentIndex: 4,
  slots: [],
  ...over,
});

beforeEach(() => {
  setProgressScope(null);
  resetPaperHistory();
  clearPaperSnapshot();
});

describe("history", () => {
  it("starts empty", () => {
    expect(getPaperHistory()).toEqual([]);
  });

  it("records a result and assigns it an id", () => {
    const r = recordPaperResult(result());
    expect(r.id).toBeTruthy();
    expect(getPaperHistory()).toHaveLength(1);
    expect(getPaperHistory()[0].score).toBe(18);
  });

  it("keeps every sitting, not just the latest", () => {
    recordPaperResult(result({ seed: 1, score: 10 }));
    recordPaperResult(result({ seed: 2, score: 20 }));
    expect(getPaperHistory()).toHaveLength(2);
  });

  it("finds the most recent sitting for a given week's seed", () => {
    recordPaperResult(result({ seed: 5, score: 12 }));
    recordPaperResult(result({ seed: 5, score: 22 })); // a retry of the same week
    recordPaperResult(result({ seed: 6, score: 9 }));
    expect(paperResultForSeed(5)?.score).toBe(22);
    expect(paperResultForSeed(6)?.score).toBe(9);
    expect(paperResultForSeed(999)).toBeUndefined();
  });

  it("resets cleanly", () => {
    recordPaperResult(result());
    resetPaperHistory();
    expect(getPaperHistory()).toEqual([]);
  });
});

describe("live snapshot", () => {
  it("is absent until something is saved", () => {
    expect(getPaperSnapshot()).toBeNull();
  });

  it("round-trips a full snapshot", () => {
    savePaperSnapshot(
      snapshot({
        slots: [{ problemId: "x", input: "x^2/2", status: "correct", flagged: false, wrongAttempts: 0, secondsSpent: 30 }],
      }),
    );
    const loaded = getPaperSnapshot();
    expect(loaded?.currentIndex).toBe(4);
    expect(loaded?.slots).toHaveLength(1);
    expect(loaded?.slots[0].status).toBe("correct");
  });

  it("overwrites rather than accumulating on repeated saves", () => {
    savePaperSnapshot(snapshot({ remainingSeconds: 5000 }));
    savePaperSnapshot(snapshot({ remainingSeconds: 4000 }));
    expect(getPaperSnapshot()?.remainingSeconds).toBe(4000);
  });

  it("clears on demand", () => {
    savePaperSnapshot(snapshot());
    clearPaperSnapshot();
    expect(getPaperSnapshot()).toBeNull();
  });
});

describe("scoping", () => {
  it("keeps two accounts' paper histories and snapshots separate", () => {
    setProgressScope("alice");
    recordPaperResult(result({ score: 5 }));
    savePaperSnapshot(snapshot({ remainingSeconds: 100 }));

    setProgressScope("bob");
    expect(getPaperHistory()).toEqual([]);
    expect(getPaperSnapshot()).toBeNull();
    recordPaperResult(result({ score: 30 }));

    setProgressScope("alice");
    expect(getPaperHistory()).toHaveLength(1);
    expect(getPaperHistory()[0].score).toBe(5);
    expect(getPaperSnapshot()?.remainingSeconds).toBe(100);

    setProgressScope(null);
  });
});
