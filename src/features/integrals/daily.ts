/**
 * The daily integral.
 *
 * Everyone gets the same problem on the same calendar day — that's what makes a score comparable
 * and the whole thing worth competing over. So selection is a pure function of the date, with no
 * server involved: a seeded shuffle of the day's difficulty pool, indexed by which occurrence of
 * that weekday it is. Nobody sees a repeat until the pool is exhausted.
 *
 * Difficulty ramps across the week — Monday is a warm-up, the weekend bites.
 */
import { PROBLEMS } from "./problems";
import type { Difficulty, Problem } from "./types";

/** Day 1 of the game. Local dates throughout: a "day" is the player's day, not UTC's. */
const EPOCH = { year: 2026, month: 0, day: 1 };

/** Sunday-first, matching Date#getDay. Difficulty climbs into the weekend. */
const WEEKDAY_DIFFICULTY: Difficulty[] = [5, 1, 2, 3, 3, 4, 5];

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Local midnight, so a player's day flips at their midnight rather than at UTC's. */
function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayIndex(date = new Date()): number {
  const epoch = new Date(EPOCH.year, EPOCH.month, EPOCH.day).getTime();
  return Math.round((midnight(date) - epoch) / 86_400_000);
}

/** The number shown on the card, and in the share text: "Daily #238". */
export function dailyNumber(date = new Date()): number {
  return dayIndex(date) + 1;
}

/** Stable key for storing a day's result. Local date, so it lines up with dayIndex. */
export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** mulberry32 — small, fast, and identical in every browser, which is the only requirement. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Sorted by id so the pool never depends on the order problems happen to be declared in. */
function poolFor(difficulty: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === difficulty).sort((a, b) => a.id.localeCompare(b.id));
}

export function dailyDifficulty(date = new Date()): Difficulty {
  return WEEKDAY_DIFFICULTY[date.getDay()];
}

export function dailyProblem(date = new Date()): Problem {
  const pool = poolFor(dailyDifficulty(date));
  if (pool.length === 0) return PROBLEMS[dayIndex(date) % PROBLEMS.length];

  // Which occurrence of this weekday it is since the epoch — that indexes into the shuffled pool,
  // and rolling over to the next cycle reshuffles with a new seed.
  const occurrence = Math.floor(dayIndex(date) / 7);
  const cycle = Math.floor(occurrence / pool.length);
  const position = ((occurrence % pool.length) + pool.length) % pool.length;
  return shuffled(pool, cycle * 7919 + date.getDay() * 104729 + 17)[position];
}

/** Seconds until the next daily unlocks — for the countdown on the result screen. */
export function secondsUntilNextDaily(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return Math.max(0, Math.round((next - now.getTime()) / 1000));
}

export interface ShareFacts {
  number: number;
  difficulty: Difficulty;
  solved: boolean;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  streak: number;
  score: number;
}

/**
 * The spoiler-free brag. Same shape as every other daily puzzle for a reason — people already know
 * how to read it, and it gives away nothing about the answer.
 */
export function shareText(f: ShareFacts): string {
  const stars = "★".repeat(f.difficulty) + "☆".repeat(5 - f.difficulty);
  const time = `${Math.floor(f.seconds / 60)}:${String(f.seconds % 60).padStart(2, "0")}`;
  const marks = f.solved
    ? "🟩".repeat(Math.max(1, 4 - f.hintsUsed - Math.min(2, f.wrongAttempts))) +
      "🟨".repeat(f.hintsUsed) +
      "🟥".repeat(Math.min(2, f.wrongAttempts))
    : "🟥🟥🟥🟥";
  const lines = [
    `∫ Daily #${f.number}  ${stars}`,
    marks,
    f.solved ? `${time} · ${f.score} pts${f.hintsUsed === 0 ? " · no hints" : ""}` : "Didn't crack it",
  ];
  if (f.streak > 1) lines.push(`🔥 ${f.streak} day streak`);
  return lines.join("\n");
}
