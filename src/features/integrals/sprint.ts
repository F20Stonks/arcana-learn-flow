/**
 * Sprint — as many integrals as you can in a fixed window.
 *
 * The daily is one problem you think about; training is one technique you work through. Neither is
 * the thing you play twice in a row. This is: pick a band and a clock, and the only question is how
 * many you can land before it runs out.
 *
 * Solves are recorded through the ordinary training path, so a sprint feeds the same XP, mastery
 * and badges as anything else. What is specific to a sprint is the run score and the personal best.
 */
import { PROBLEMS } from "./problems";
import { shuffled } from "./rng";
import type { Difficulty, Problem } from "./types";

export type BandId = "warmup" | "mixed" | "hard" | "brutal";

export interface Band {
  id: BandId;
  name: string;
  blurb: string;
  difficulties: Difficulty[];
}

export const BANDS: Band[] = [
  {
    id: "warmup",
    name: "Warm-up",
    blurb: "Standard forms and one-step substitutions. Pure speed, no thinking.",
    difficulties: [1, 2],
  },
  {
    id: "mixed",
    name: "Mixed",
    blurb: "Everything up to a solid mid-paper problem. The default.",
    difficulties: [1, 2, 3],
  },
  {
    id: "hard",
    name: "Hard",
    blurb: "Nothing you can do on sight. Parts, trig substitution, partial fractions.",
    difficulties: [3, 4, 5],
  },
  {
    id: "brutal",
    name: "Brutal",
    blurb: "The ones that take a page. You will not finish many.",
    difficulties: [4, 5],
  },
];

export const BAND_BY_ID: Record<BandId, Band> = Object.fromEntries(
  BANDS.map((b) => [b.id, b]),
) as Record<BandId, Band>;

export const DURATIONS = [60, 180, 300] as const;
export type Duration = (typeof DURATIONS)[number];

export interface SprintConfig {
  band: BandId;
  seconds: Duration;
}

const SETUP_KEY = "arcana.integrals.sprint-setup";

/**
 * The last setup used. Anyone who runs Brutal · 5 min runs it again; making them re-pick both
 * every visit is a toll on the one mode you are meant to play twice in a row.
 */
export function storedSetup(): SprintConfig {
  const fallback: SprintConfig = { band: "mixed", seconds: 180 };
  try {
    const raw = globalThis.localStorage?.getItem(SETUP_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SprintConfig>;
    const band = BANDS.some((b) => b.id === parsed.band) ? (parsed.band as BandId) : fallback.band;
    const seconds = DURATIONS.includes(parsed.seconds as Duration)
      ? (parsed.seconds as Duration)
      : fallback.seconds;
    return { band, seconds };
  } catch {
    return fallback;
  }
}

export function rememberSetup(config: SprintConfig) {
  try {
    globalThis.localStorage?.setItem(SETUP_KEY, JSON.stringify(config));
  } catch {
    // No storage, no memory — the sprint still runs.
  }
}

/** One key per configuration, so a 60-second warm-up best never competes with a 5-minute brutal. */
export function configKey(config: SprintConfig): string {
  return `${config.band}-${config.seconds}`;
}

export function describeConfig(config: SprintConfig): string {
  return `${BAND_BY_ID[config.band].name} · ${config.seconds / 60 >= 1 ? `${config.seconds / 60} min` : `${config.seconds}s`}`;
}

/**
 * The run's queue. Long enough that nobody reaches the end — a sprint that runs out of problems
 * would silently cap the score and make two runs incomparable.
 *
 * Already-solved problems are pushed to the back rather than dropped outright: a sprint still
 * needs to be "long enough that nobody reaches the end" even for a player who has cleared most of
 * a band, and a repeat is a much smaller ask than running out of problems mid-run.
 */
export function buildQueue(
  config: SprintConfig,
  seed: number,
  solvedIds: ReadonlySet<string> = new Set(),
): Problem[] {
  const band = BAND_BY_ID[config.band];
  const pool = PROBLEMS.filter((p) => band.difficulties.includes(p.difficulty)).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const shuffledPool = shuffled(pool, seed);
  const unsolved = shuffledPool.filter((p) => !solvedIds.has(p.id));
  const solved = shuffledPool.filter((p) => solvedIds.has(p.id));
  return [...unsolved, ...solved];
}

const SOLVE_POINTS: Record<Difficulty, number> = { 1: 10, 2: 20, 3: 35, 4: 55, 5: 80 };

/** What one solve pays. Exported so the run can tell you the moment you land it. */
export function solvePoints(difficulty: Difficulty): number {
  return SOLVE_POINTS[difficulty];
}

/** Skipping is allowed and costs a little — otherwise the best strategy is to skip until you get an easy one. */
export const SKIP_PENALTY = 8;

export interface SprintResult {
  solved: Problem[];
  skipped: number;
  wrongAttempts: number;
  /**
   * The ones that got away — skipped, plus whatever was on screen when the clock stopped. The
   * result screen shows them with their answers, because a sprint you learn nothing from is just
   * a typing test.
   */
  missed: Problem[];
  score: number;
  config: SprintConfig;
}

export function sprintScore(solved: readonly Problem[], skipped: number): number {
  const earned = solved.reduce((total, p) => total + SOLVE_POINTS[p.difficulty], 0);
  return Math.max(0, earned - skipped * SKIP_PENALTY);
}

/** Points per minute — the number that makes a 60-second run comparable to a 5-minute one. */
export function sprintRate(result: SprintResult): number {
  return Math.round((result.score / result.config.seconds) * 60);
}
