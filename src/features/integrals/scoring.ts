/**
 * Scoring, XP and rank.
 *
 * One rule shapes all of it: the points should reward *knowing the technique*, not grinding. So
 * speed matters, hints cost, and a repeat solve of a problem you've already beaten is worth a
 * fraction of the first — otherwise the leaderboard measures free time rather than skill.
 */
import type { Difficulty } from "./types";

export interface AttemptFacts {
  difficulty: Difficulty;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  /** Daily streak in days, at the moment of solving. Training runs pass 0. */
  streak: number;
  mode: "daily" | "training";
  /** Second and later solves of the same problem earn a fraction. */
  repeat: boolean;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  hintPenalty: number;
  attemptPenalty: number;
  streakMultiplier: number;
  modeMultiplier: number;
  total: number;
}

/** Par time in seconds — beat it for the speed bonus, take twice it and the bonus is gone. */
export const PAR_SECONDS: Record<Difficulty, number> = { 1: 30, 2: 60, 3: 120, 4: 210, 5: 330 };

/** Exported so the history view can grade a day against what that day was worth. */
export const BASE_POINTS: Record<Difficulty, number> = { 1: 40, 2: 80, 3: 150, 4: 260, 5: 420 };

/** Hints cost 20% of base each, and never more than 60% in total. */
const HINT_RATE = 0.2;
const HINT_CAP = 0.6;

function hintFraction(hintsUsed: number): number {
  return Math.min(HINT_CAP, HINT_RATE * hintsUsed);
}

/**
 * What the *next* hint actually costs, given how many have already been taken.
 *
 * The button used to read "−20%" for every hint on the ladder, including the fourth and later,
 * which are free — the penalty is capped by then. Stating a price that is not charged is the same
 * class of mistake as charging one that was not stated.
 */
export function nextHintCost(hintsUsed: number): number {
  return hintFraction(hintsUsed + 1) - hintFraction(hintsUsed);
}

export function scoreAttempt(a: AttemptFacts): ScoreBreakdown {
  const base = BASE_POINTS[a.difficulty];
  const par = PAR_SECONDS[a.difficulty];

  // Full bonus for instant, nothing once you've spent twice par. Linear in between.
  const speedRatio = Math.max(0, Math.min(1, (2 * par - a.seconds) / (2 * par)));
  const speedBonus = Math.round(base * 0.5 * speedRatio);

  // Hints are meant to be usable, not free — but the cost stops climbing at the cap.
  const hintPenalty = -Math.round(base * hintFraction(a.hintsUsed));
  const attemptPenalty = -Math.round(base * Math.min(0.3, 0.1 * a.wrongAttempts));

  const streakMultiplier = a.mode === "daily" ? 1 + 0.05 * Math.min(10, a.streak) : 1;
  const modeMultiplier = (a.mode === "daily" ? 1 : 0.5) * (a.repeat ? 0.25 : 1);

  const subtotal = base + speedBonus + hintPenalty + attemptPenalty;
  const total = Math.max(5, Math.round(subtotal * streakMultiplier * modeMultiplier));

  return { base, speedBonus, hintPenalty, attemptPenalty, streakMultiplier, modeMultiplier, total };
}

/** Cumulative XP needed to *reach* a level. Level 1 is the starting point, so it costs nothing. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 125 * n * (n + 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelState {
  level: number;
  rank: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0–1, for the progress bar. */
  progress: number;
}

const RANKS: Array<{ from: number; name: string }> = [
  { from: 1, name: "Riemann Novice" },
  { from: 3, name: "Substitution Apprentice" },
  { from: 5, name: "Parts Practitioner" },
  { from: 8, name: "Trig Tactician" },
  { from: 11, name: "Partial Fractionist" },
  { from: 15, name: "Contour Adept" },
  { from: 20, name: "Integral Archmage" },
];

export function rankForLevel(level: number): string {
  let name = RANKS[0].name;
  for (const r of RANKS) if (level >= r.from) name = r.name;
  return name;
}

export function levelState(xp: number): LevelState {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const span = ceiling - floor;
  return {
    level,
    rank: rankForLevel(level),
    xpIntoLevel: xp - floor,
    xpForNextLevel: span,
    progress: span > 0 ? (xp - floor) / span : 1,
  };
}

/** "1:24" / "12:05" — the format a leaderboard wants. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
