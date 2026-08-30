/**
 * Headsolving (WS-9, UK_BEE_BURST.md Extension 2) — pure domain logic.
 *
 * Every clock elsewhere in this app measures mathematics plus typing: solve in six seconds, spend
 * twenty-five typing the answer, and the app records thirty-one and calls it done. That number
 * doesn't transfer to a competition written by hand, where the only thing that matters is how long
 * it takes to *know* the answer. Headsolve mode measures exactly that and nothing else — there is
 * no answer input at all. A problem appears, the competitor thinks, one keypress stops the clock,
 * the reference answer is revealed, and they self-grade got it / close / no. Nothing is typed, so
 * nothing needs parsing — self-grading is not a compromise here, it's the only honest option for a
 * mode with no text to check.
 *
 * This module is the pure half: which problem to show next, and how the difficulty ladder responds
 * to a grade. Storage lives in headsolveHistory.ts, the run in hooks/useHeadsolveRun.ts.
 */
import { shuffled } from "./rng";
import { median } from "./recognition";
import { primaryTechnique } from "./problems";
import type { Difficulty, Problem, TechniqueId } from "./types";

// ── bands and targets ─────────────────────────────────────────────────────────────────────────
//
// Difficulty-based, same grouping paper.ts uses for its three bands — but named and thresholded
// independently, because these are think-time-only targets (UK_BEE_BURST.md's own numbers), not
// the full solve-and-write budget paper.ts's bands are paced against. Deliberately "mid", not
// paper.ts's "solid", so nobody mistakes the two for the same concept re-exported under a new name.

export type HeadsolveBandId = "accessible" | "mid" | "tail";

export function bandForDifficulty(difficulty: Difficulty): HeadsolveBandId {
  if (difficulty <= 2) return "accessible";
  if (difficulty === 3) return "mid";
  return "tail";
}

export const HEADSOLVE_BAND_LABEL: Record<HeadsolveBandId, string> = {
  accessible: "Accessible",
  mid: "Mid",
  tail: "Tail",
};

/**
 * Think-time targets, taken directly from the runbook's own solo Round 1 budget — not invented.
 * No target is stated there for the tail band, so this stays null rather than making one up: a
 * caller shows no target badge for a tail problem instead of comparing against a guessed number.
 */
export const HEADSOLVE_TARGET_MS: Record<HeadsolveBandId, number | null> = {
  accessible: 30_000,
  mid: 90_000,
  tail: null,
};

export function headsolveBand(problem: Problem): HeadsolveBandId {
  return bandForDifficulty(problem.difficulty);
}

export function headsolveTargetMs(problem: Problem): number | null {
  return HEADSOLVE_TARGET_MS[headsolveBand(problem)];
}

/** Whether `thinkMs` beat its band's target. Null — not false — when the band has no target at
 *  all, so a caller can render "no fixed target" instead of a misleading miss. */
export function beatsTarget(band: HeadsolveBandId, thinkMs: number): boolean | null {
  const target = HEADSOLVE_TARGET_MS[band];
  return target === null ? null : thinkMs <= target;
}

// ── self-grading ───────────────────────────────────────────────────────────────────────────────

export type HeadsolveGrade = "got-it" | "close" | "no";

export const HEADSOLVE_GRADES: readonly HeadsolveGrade[] = ["got-it", "close", "no"];

/** One graded headsolve attempt — persisted by headsolveHistory.ts, also mirrored (coarsely) into
 *  the shared WS-1 attempt log under mode "headsolve" so the two never get averaged together. */
export interface HeadsolveAttempt {
  id: string;
  problemId: string;
  /** The problem's primary technique — what was actually being tested. */
  technique: TechniqueId;
  band: HeadsolveBandId;
  grade: HeadsolveGrade;
  /** Problem shown → clock stopped, ms. The one number headsolve mode exists to measure: pure
   *  think time, uncontaminated by typing. */
  thinkMs: number;
  /** Whether thinkMs beat the band's target; null when the band (tail) has no defined target. */
  beatTarget: boolean | null;
  at: string;
}

// ── the ladder ─────────────────────────────────────────────────────────────────────────────────

export interface HeadsolveLadderState {
  level: number;
  streak: number;
}

export function initialLadderState(): HeadsolveLadderState {
  return { level: 0, streak: 0 };
}

/** Consecutive "got it" grades needed to climb one level — a single lucky solve shouldn't jump the
 *  ladder; three clean ones in a row is a fair bar for "this level is no longer testing you". */
export const SUCCESS_STREAK_TO_LEVEL_UP = 3;

export function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT - 1, Math.max(0, level));
}

/**
 * The ladder's whole response to one self-grade:
 * - "got it" builds the streak, and only cashes it in for a level once the streak reaches
 *   SUCCESS_STREAK_TO_LEVEL_UP — one solve proves nothing, three in a row does.
 * - "close" breaks the streak without demoting: the method was basically there, so the level holds
 *   while the streak resets and has to be rebuilt from zero.
 * - "no" both breaks the streak and drops a level — a clean miss means the current level is
 *   currently too hard, and the next problem should be gentler.
 */
export function applyGrade(state: HeadsolveLadderState, grade: HeadsolveGrade): HeadsolveLadderState {
  if (grade === "got-it") {
    const streak = state.streak + 1;
    if (streak >= SUCCESS_STREAK_TO_LEVEL_UP) return { level: clampLevel(state.level + 1), streak: 0 };
    return { ...state, streak };
  }
  if (grade === "close") return { ...state, streak: 0 };
  return { level: clampLevel(state.level - 1), streak: 0 };
}

// ── headsolvability ranking ────────────────────────────────────────────────────────────────────
//
// Ladders by headsolvability, not the bank's own `difficulty` — a problem can be trivial on paper
// and impossible in the head (long algebra to track with nothing to write on), or ugly-looking and
// instant (a symmetry collapse, a memorised flagship result). Seeded from technique, refined by
// observed headsolve success — exactly per the runbook.
//
// Seed tiers, fastest-in-the-head first. Reasoning, so a future session can sanity-check or adjust
// this without re-deriving it from scratch:
//   0. symmetry            — the recognition IS the solve; its own recipe says "the answer is 0,
//                             no work required" for the odd case, and King's rule collapses a
//                             hard-looking integrand with one relabelling, no antiderivative at all.
//   1. recognition-led      — the "finals arsenal": once you spot the family the value is close to
//      / standard forms       memorised, not derived from scratch every time (Beta, Gamma, Wallis,
//                             zeta-series, log-power, Gaussian, reciprocal-substitution, the
//                             inverse-integral identity, introducing-constants).
//   2. one clean step       — power, u-sub, Feynman: a single substitution or a single
//                             differentiation-under-the-integral, low branching.
//   3. a drilled multi-step — t-sub, trig-identity, complete-square, recurrence: more than one
//      derivation             algebraic beat, but a well-rehearsed one with a fixed shape.
//   4. heavier bookkeeping  — parts, trig-sub, partial-fractions, floor-function: genuinely more
//                             moving parts to hold in your head at once, easy to lose track of
//                             mentally even when it's completely routine on paper.
//
// This is a starting prior, not a verdict — techniqueAdjustments() below lets real observed
// headsolve accuracy pull a technique's effective tier earlier or later than this seed places it.
export const SEED_TIERS: readonly TechniqueId[][] = [
  ["symmetry"],
  [
    "beta-integrals",
    "gamma-function",
    "zeta-series",
    "wallis-product",
    "log-power-integrals",
    "gaussian-hypersphere",
    "reciprocal-substitution",
    "inverse-integral",
    "introducing-constants",
  ],
  ["power", "u-sub", "feynman"],
  ["t-sub", "trig-identity", "complete-square", "recurrence"],
  ["parts", "trig-sub", "partial-fractions", "floor-function"],
];

export const SEED_TIER_BY_TECHNIQUE: Record<TechniqueId, number> = (() => {
  const map = {} as Record<TechniqueId, number>;
  SEED_TIERS.forEach((tier, i) => tier.forEach((id) => (map[id] = i)));
  return map;
})();

const TIER_WIDTH = 100;
const DIFFICULTY_STEP = 10;

/** Below this many decisive (got-it or no) headsolve attempts on a technique, there isn't enough
 *  evidence to override the seed prior — a rate from one or two picks is noise, not a signal. */
const MIN_TECHNIQUE_SAMPLE = 5;

/** How far real observed evidence can pull a technique's score from its seed tier — a bit more
 *  than one tier's width (TIER_WIDTH), so persistent evidence can eventually outrank the seed
 *  prior entirely (this is the "let observed success refine it" half of the design), but not so
 *  much that a single technique's run of luck vaults it several tiers in one sitting. */
const MAX_HISTORY_ADJUSTMENT = 120;

export interface TechniqueHeadsolveStats {
  technique: TechniqueId;
  attempts: number;
  gotIt: number;
  close: number;
  no: number;
  /** gotIt / attempts — "close" counts against this the same as "no" would, since it wasn't a
   *  clean solve. The internal tier-adjustment below uses a different, stricter ratio; see there. */
  successRate: number;
  medianThinkMs: number | null;
}

/** Accuracy and median think time per technique, most-attempted first. */
export function statsByTechnique(attempts: readonly HeadsolveAttempt[]): TechniqueHeadsolveStats[] {
  const byTechnique = new Map<TechniqueId, HeadsolveAttempt[]>();
  for (const a of attempts) {
    const list = byTechnique.get(a.technique);
    if (list) list.push(a);
    else byTechnique.set(a.technique, [a]);
  }
  return [...byTechnique.entries()]
    .map(([technique, list]) => {
      const gotIt = list.filter((a) => a.grade === "got-it").length;
      const close = list.filter((a) => a.grade === "close").length;
      const no = list.filter((a) => a.grade === "no").length;
      return {
        technique,
        attempts: list.length,
        gotIt,
        close,
        no,
        successRate: list.length ? gotIt / list.length : 0,
        medianThinkMs: median(list.map((a) => a.thinkMs)),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

/**
 * How far to shift each technique's seed tier, based on real evidence. Deliberately uses only the
 * decisive grades (got-it, no) — "close" is genuinely ambiguous (right idea, unclear if it would
 * have landed) and is excluded here so it can't nudge a technique's headsolvability either way; it
 * still counts fully in statsByTechnique's own successRate, which is a different, more forgiving
 * question ("how often did you walk away with a clean answer").
 */
function techniqueAdjustments(attempts: readonly HeadsolveAttempt[]): Map<TechniqueId, number> {
  const decisive = new Map<TechniqueId, { gotIt: number; no: number }>();
  for (const a of attempts) {
    if (a.grade === "close") continue;
    const cur = decisive.get(a.technique) ?? { gotIt: 0, no: 0 };
    if (a.grade === "got-it") cur.gotIt += 1;
    else cur.no += 1;
    decisive.set(a.technique, cur);
  }

  const adjustments = new Map<TechniqueId, number>();
  for (const [technique, { gotIt, no }] of decisive) {
    const total = gotIt + no;
    if (total < MIN_TECHNIQUE_SAMPLE) continue;
    const rate = gotIt / total;
    if (rate >= 0.75) adjustments.set(technique, -MAX_HISTORY_ADJUSTMENT);
    else if (rate <= 0.35) adjustments.set(technique, MAX_HISTORY_ADJUSTMENT);
  }
  return adjustments;
}

/** Lower = more headsolvable. Technique tier dominates (tiers are TIER_WIDTH apart); difficulty is
 *  a fine-grained tiebreak within a tier (even a "fast" technique gets slower as it gets harder);
 *  observed evidence can shift a technique by up to MAX_HISTORY_ADJUSTMENT either way. */
function headsolvabilityScore(problem: Problem, adjustments: Map<TechniqueId, number>): number {
  const technique = primaryTechnique(problem);
  // Every real TechniqueId is covered by SEED_TIERS (see headsolve.test.ts's guard); the fallback
  // below only matters defensively, so a future technique added without updating SEED_TIERS here
  // degrades to "treated as the slowest tier" rather than crashing or silently ranking first.
  const tier = SEED_TIER_BY_TECHNIQUE[technique] ?? SEED_TIERS.length;
  const base = tier * TIER_WIDTH + (problem.difficulty - 1) * DIFFICULTY_STEP;
  return base + (adjustments.get(technique) ?? 0);
}

/** Every problem, ordered most- to least-headsolvable. Recomputed fresh each call — cheap even
 *  over the whole bank, and it means the ordering always reflects the latest evidence. */
export function rankedByHeadsolvability(
  problems: readonly Problem[],
  attempts: readonly HeadsolveAttempt[],
): Problem[] {
  const adjustments = techniqueAdjustments(attempts);
  return [...problems].sort((a, b) => {
    const delta = headsolvabilityScore(a, adjustments) - headsolvabilityScore(b, adjustments);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

// ── the ladder's pool ──────────────────────────────────────────────────────────────────────────

/** How many discrete rungs the ladder has. Coarse enough that levelling up feels like a real step
 *  up, fine enough that ~788 problems split into levels of comfortable, browsable size. */
export const LEVEL_COUNT = 12;

/**
 * The contiguous slice of the headsolvability-ranked list that belongs to `level` — level 0 is the
 * most headsolvable slice, LEVEL_COUNT - 1 the least. Always non-empty when `ranked` is non-empty:
 * every level's slice starts at a valid index and spans at least one item, even on a tiny pool.
 */
export function poolForLevel(ranked: readonly Problem[], level: number): Problem[] {
  if (ranked.length === 0) return [];
  const chunk = Math.ceil(ranked.length / LEVEL_COUNT);
  const start = Math.min(ranked.length - 1, clampLevel(level) * chunk);
  const end = Math.min(ranked.length, start + chunk);
  return ranked.slice(start, end);
}

/**
 * Picks the next problem to show at `level`. `seed` drives the (reproducible) randomness — the
 * caller passes Date.now(), the same convention assembleRound and scheduledQueue already use.
 * Avoids `excludeIds` (recently shown, so a session doesn't repeat a problem back to back) whenever
 * the level's pool is large enough to honour that, and otherwise falls back to allowing a repeat —
 * "this level currently has exactly one candidate" is a real small-pool situation to degrade
 * gracefully into, not a case to return nothing for.
 */
export function nextHeadsolveProblem(
  problems: readonly Problem[],
  level: number,
  attempts: readonly HeadsolveAttempt[],
  excludeIds: ReadonlySet<string>,
  seed: number,
): Problem | null {
  const ranked = rankedByHeadsolvability(problems, attempts);
  const pool = poolForLevel(ranked, level);
  if (pool.length === 0) return null;
  const candidates = pool.filter((p) => !excludeIds.has(p.id));
  const from = candidates.length > 0 ? candidates : pool;
  return shuffled(from, seed)[0];
}

// ── summaries ──────────────────────────────────────────────────────────────────────────────────

export interface BandHeadsolveStats {
  band: HeadsolveBandId;
  attempts: number;
  gotIt: number;
  medianThinkMs: number | null;
  /** Fraction of this band's attempts that beat its target; null when the band has no target
   *  (tail) or there are no attempts yet in it. */
  beatTargetRate: number | null;
}

function bandStats(attempts: readonly HeadsolveAttempt[], band: HeadsolveBandId): BandHeadsolveStats {
  const list = attempts.filter((a) => a.band === band);
  const targeted = list.filter((a) => a.beatTarget !== null);
  const beat = targeted.filter((a) => a.beatTarget === true).length;
  return {
    band,
    attempts: list.length,
    gotIt: list.filter((a) => a.grade === "got-it").length,
    medianThinkMs: median(list.map((a) => a.thinkMs)),
    beatTargetRate: targeted.length > 0 ? beat / targeted.length : null,
  };
}

export function statsByBand(attempts: readonly HeadsolveAttempt[]): BandHeadsolveStats[] {
  return (["accessible", "mid", "tail"] as const).map((band) => bandStats(attempts, band));
}

export interface HeadsolveSummary {
  total: number;
  gotIt: number;
  close: number;
  no: number;
  medianThinkMs: number | null;
  /** Over attempts whose band has a defined target only (excludes the tail band). Null with no
   *  such attempts yet. */
  beatTargetRate: number | null;
  byTechnique: TechniqueHeadsolveStats[];
  byBand: BandHeadsolveStats[];
}

export function summarizeHeadsolve(attempts: readonly HeadsolveAttempt[]): HeadsolveSummary {
  const targeted = attempts.filter((a) => a.beatTarget !== null);
  const beat = targeted.filter((a) => a.beatTarget === true).length;
  return {
    total: attempts.length,
    gotIt: attempts.filter((a) => a.grade === "got-it").length,
    close: attempts.filter((a) => a.grade === "close").length,
    no: attempts.filter((a) => a.grade === "no").length,
    medianThinkMs: median(attempts.map((a) => a.thinkMs)),
    beatTargetRate: targeted.length > 0 ? beat / targeted.length : null,
    byTechnique: statsByTechnique(attempts),
    byBand: statsByBand(attempts),
  };
}
