/**
 * UK Round 1 paper mode — 30 problems in 120 minutes, assembled deterministically from a seed.
 *
 * Mirrors the real solo format this whole burst exists for: three bands of ten by difficulty
 * (≤2 / 3 / 4–5), leaning definite (~70% per band, since a numeric answer is what a real
 * competition paper mostly asks for). This is deliberately NOT one-problem-at-a-time like training
 * or the daily — a real paper lets you skip around, flag a question and come back — so it gets its
 * own free-navigation answer sheet (see hooks/usePaperRun.ts) rather than reusing their lockstep
 * flow. What IS reused, per the runbook: `shuffled` from rng.ts, and gradeAnswer from answer.ts
 * (wired in usePaperRun) — nothing here reimplements either.
 */
import { shuffled } from "../rng";
import { PROBLEMS } from "../problems";
import type { Difficulty, Problem } from "../types";

export const PAPER_QUESTION_COUNT = 30;
export const PAPER_MINUTES = 120;
export const PAPER_SECONDS = PAPER_MINUTES * 60;
export const QUESTIONS_PER_BAND = 10;

/** Target share of definite (as opposed to indefinite) problems per band — a real paper leans
 *  definite, since "evaluate this" is the more common ask than "find an antiderivative". */
const DEFINITE_SHARE = 0.7;

export type PaperBandId = "accessible" | "solid" | "tail";

export interface PaperBand {
  id: PaperBandId;
  /** Shown on the sheet, e.g. "Q1–10". */
  label: string;
  name: string;
  difficulties: Difficulty[];
  /** Index range within the assembled 30 (0-based, end exclusive). */
  start: number;
  end: number;
}

export const PAPER_BANDS: PaperBand[] = [
  { id: "accessible", label: "Q1–10", name: "Accessible", difficulties: [1, 2], start: 0, end: 10 },
  { id: "solid", label: "Q11–20", name: "Solid", difficulties: [3], start: 10, end: 20 },
  { id: "tail", label: "Q21–30", name: "The tail", difficulties: [4, 5], start: 20, end: 30 },
];

export function bandForIndex(index: number): PaperBand {
  return PAPER_BANDS.find((b) => index >= b.start && index < b.end) ?? PAPER_BANDS[PAPER_BANDS.length - 1];
}

export function bandById(id: PaperBandId): PaperBand {
  return PAPER_BANDS.find((b) => b.id === id) ?? PAPER_BANDS[0];
}

/** One band's ten problems, leaning definite, deterministic in (seed, bandOffset). */
function assembleBand(pool: Problem[], seed: number, bandOffset: number): Problem[] {
  const definite = pool.filter((p) => p.kind === "definite");
  const indefinite = pool.filter((p) => p.kind === "indefinite");
  const targetDefinite = Math.round(QUESTIONS_PER_BAND * DEFINITE_SHARE);
  const targetIndefinite = QUESTIONS_PER_BAND - targetDefinite;

  const shuffledDefinite = shuffled(definite, seed * 7919 + bandOffset * 104729 + 11);
  const shuffledIndefinite = shuffled(indefinite, seed * 7919 + bandOffset * 104729 + 23);

  const takenDefinite = shuffledDefinite.slice(0, targetDefinite);
  const takenIndefinite = shuffledIndefinite.slice(0, targetIndefinite);

  // Defensive backfill: today's bank has comfortably more than enough of each kind in every band
  // (see paper.test.ts), but if a future content pass ever skews a band hard enough to run short,
  // fill from the leftovers of either kind rather than silently shipping a paper with fewer than
  // QUESTIONS_PER_BAND problems in it.
  const shortfall = QUESTIONS_PER_BAND - takenDefinite.length - takenIndefinite.length;
  const leftovers =
    shortfall > 0
      ? [...shuffledDefinite.slice(takenDefinite.length), ...shuffledIndefinite.slice(takenIndefinite.length)]
      : [];

  const chosen = [...takenDefinite, ...takenIndefinite, ...leftovers.slice(0, shortfall)];
  // One more shuffle so the ten don't sit in "all definite, then all indefinite" blocks.
  return shuffled(chosen, seed * 7919 + bandOffset * 104729 + 37);
}

/**
 * The paper's 30 problems, in question order (Q1 first, band by band). Deterministic: the same
 * seed always assembles the same paper, so a specific sitting can be reviewed, compared or retried
 * later with the exact same questions.
 */
export function assemblePaper(seed: number): Problem[] {
  return PAPER_BANDS.flatMap((band, i) => {
    const pool = PROBLEMS.filter((p) => band.difficulties.includes(p.difficulty));
    return assembleBand(pool, seed, i);
  });
}

function midnightLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * This calendar week's seed — one paper per week, so "this week's paper" means the same thing all
 * week (reloading mid-sitting doesn't reshuffle it) while next week is a fresh one. Weeks are
 * Sunday-aligned to match `dayKey`/`dailyProblems` elsewhere in this feature.
 */
export function weekSeed(date = new Date()): number {
  const epoch = new Date(2026, 0, 4).getTime(); // a Sunday, so week boundaries land on Sundays
  const days = Math.floor((midnightLocal(date) - epoch) / 86_400_000);
  return Math.floor(days / 7);
}

/** The Monday-of-week label a seed corresponds to, for "week of 5 Oct" style headings. */
export function weekLabel(seed: number): string {
  const epoch = new Date(2026, 0, 4).getTime();
  const sunday = new Date(epoch + seed * 7 * 86_400_000);
  const monday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 1);
  return monday.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
