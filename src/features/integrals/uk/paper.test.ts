import { describe, expect, it } from "vitest";
import {
  assemblePaper,
  bandForIndex,
  PAPER_BANDS,
  PAPER_QUESTION_COUNT,
  QUESTIONS_PER_BAND,
  weekSeed,
} from "./paper";

describe("assemblePaper", () => {
  it("is deterministic in its seed", () => {
    const a = assemblePaper(42).map((p) => p.id);
    const b = assemblePaper(42).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("varies across seeds", () => {
    const a = assemblePaper(1).map((p) => p.id);
    const b = assemblePaper(2).map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  it("always has exactly 30 problems", () => {
    for (const seed of [0, 1, 7, 100, 999]) {
      expect(assemblePaper(seed)).toHaveLength(PAPER_QUESTION_COUNT);
    }
  });

  it("has no duplicate problems within one paper", () => {
    for (const seed of [0, 1, 7, 100, 999]) {
      const ids = assemblePaper(seed).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("puts the right difficulty band at each question range", () => {
    const paper = assemblePaper(5);
    for (const band of PAPER_BANDS) {
      for (let i = band.start; i < band.end; i++) {
        expect(band.difficulties, `Q${i + 1}`).toContain(paper[i].difficulty);
      }
    }
  });

  it("gives every band exactly QUESTIONS_PER_BAND problems", () => {
    const paper = assemblePaper(3);
    for (const band of PAPER_BANDS) {
      expect(band.end - band.start).toBe(QUESTIONS_PER_BAND);
    }
    expect(paper.length).toBe(PAPER_BANDS.length * QUESTIONS_PER_BAND);
  });

  it("leans definite (~70%) within each band, across many seeds", () => {
    for (const band of PAPER_BANDS) {
      let definite = 0;
      const seeds = 30;
      for (let seed = 0; seed < seeds; seed++) {
        const paper = assemblePaper(seed);
        const slice = paper.slice(band.start, band.end);
        definite += slice.filter((p) => p.kind === "definite").length;
      }
      const ratio = definite / (seeds * QUESTIONS_PER_BAND);
      expect(ratio, `${band.id} definite ratio`).toBeGreaterThan(0.55);
      expect(ratio, `${band.id} definite ratio`).toBeLessThan(0.85);
    }
  });

  it("covers the whole 1-5 difficulty range across its three bands", () => {
    const covered = new Set(PAPER_BANDS.flatMap((b) => b.difficulties));
    expect([...covered].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("bandForIndex", () => {
  it("maps every question index to exactly the band that owns it", () => {
    for (let i = 0; i < PAPER_QUESTION_COUNT; i++) {
      const band = bandForIndex(i);
      expect(i).toBeGreaterThanOrEqual(band.start);
      expect(i).toBeLessThan(band.end);
    }
  });

  it("has contiguous, gapless band ranges covering the whole paper", () => {
    const sorted = [...PAPER_BANDS].sort((a, b) => a.start - b.start);
    expect(sorted[0].start).toBe(0);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].start).toBe(sorted[i - 1].end);
    expect(sorted[sorted.length - 1].end).toBe(PAPER_QUESTION_COUNT);
  });
});

describe("weekSeed", () => {
  it("is the same seed on every day of the same week", () => {
    const sunday = new Date(2026, 8, 6); // a Sunday
    const seeds = [0, 1, 2, 3, 4, 5, 6].map((d) => weekSeed(new Date(2026, 8, 6 + d)));
    expect(new Set(seeds).size).toBe(1);
    expect(weekSeed(sunday)).toBe(seeds[0]);
  });

  it("advances by exactly one across a week boundary", () => {
    const saturday = weekSeed(new Date(2026, 8, 12));
    const nextSunday = weekSeed(new Date(2026, 8, 13));
    expect(nextSunday).toBe(saturday + 1);
  });
});
