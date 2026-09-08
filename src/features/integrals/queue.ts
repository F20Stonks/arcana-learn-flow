import { hasSolved, type Progress } from "./progress";
import type { AttemptRecord, VerdictClass } from "./attempts";
import type { Problem, TechniqueId } from "./types";

/**
 * Practice order: unsolved first, easiest first inside each half. Callers freeze the result at
 * mount — re-sorting as you solve would move the queue out from under you mid-session.
 *
 * Kept exported and unchanged for any caller not migrated to `scheduledQueue` below — see that
 * function's doc comment for why `IntegralTraining.tsx` still calls this one specifically.
 */
export function orderQueue(pool: Problem[], progress: Progress): Problem[] {
  const rank = (p: Problem) => (hasSolved(progress, p.id) ? 100 : 0) + p.difficulty;
  return pool.slice().sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

// ── scheduler (WS-4, UK_BEE_BURST.md) ─────────────────────────────────────────────────────────
//
// orderQueue's whole model of "due" is a binary: solved or not. That's fine for a first pass but
// has nothing to say about a 70-day programme, where a problem solved once nine weeks ago and a
// problem solved yesterday are both just "solved" to it. scheduledQueue reads the WS-1 attempt
// log to do better, weighing (roughly in this order of influence, per the runbook):
//   1. retention decay    — time since last correct solve, scaled by how hard that solve was;
//   2. weakness           — per-technique failure rate across recorded attempts;
//   3. near-miss priority — an unsolved problem last missed by only a constant factor outranks
//                            one he had no idea about — the method was right;
//   4. target success band — the served queue leans toward a mix that nets out near ~70% odds,
//                             not always leading with the single most-overdue (and often hardest)
//                             item, which would front-load difficulty and demoralise;
//   5. interleaving        — a light final pass so consecutive picks don't share a technique.
//
// Same contract as orderQueue: a pure function of its inputs, meant to be called once and frozen
// at mount by the caller — see that comment above for why.

const MS_PER_DAY = 86_400_000;

/** A clean solve (no wrong attempts on the way to it) is treated as "due for review" again after
 *  roughly this many days; a solve that took several wrong attempts decays faster than this, in
 *  proportion — see hardnessFactor. Chosen to sit comfortably inside a 70-day programme (a clean
 *  solve should resurface a handful of times over 70 days, not zero and not every other day). */
const BASE_HALFLIFE_DAYS = 6;

/** How many attempts, at most, count toward "how hard was the solve" — one bad day of five wrong
 *  guesses on an easy slip shouldn't be allowed to outweigh everything else forever. */
const HARDNESS_ATTEMPT_CAP = 4;

/** How much a technique's own failure rate (0..1 across recorded attempts) amplifies a problem's
 *  urgency. 0 would ignore weakness entirely; at 1, a technique that's failed every attempt gets
 *  roughly double the urgency of one that's never failed. */
const WEAKNESS_GAIN = 1.2;

/** Urgency band every not-yet-solved problem sits in — comfortably above anything the "solved,
 *  decaying" branch can produce (that branch is explicitly clamped below this), so "unsolved
 *  beats solved" holds exactly like orderQueue's own contract, however stale a solved problem
 *  gets. */
const UNSOLVED_BASE = 1000;

/** Extra urgency for a not-yet-solved problem whose most recent attempt was off-by-constant-
 *  factor — "the method was right" — so it's served back sooner than one with no attempts, or one
 *  whose last attempt was flatly wrong. Both of those still sit in the same UNSOLVED_BASE tier as
 *  each other; the runbook's "worth more than problems he had no idea about" is specifically
 *  about the near-miss case, not a ranking between "never tried" and "tried and missed". */
const NEAR_MISS_BONUS = 500;

export const TARGET_SUCCESS_DEFAULT = 0.7;

interface ProblemAttemptStats {
  /** Verdict of the most recent attempt on this problem, whatever it was. */
  lastVerdict: VerdictClass | null;
  /** wrongAttemptsSoFar recorded on the most recent attempt that was itself correct — "how hard
   *  was the last successful solve", independent of any fiddling after the fact. Null if this
   *  problem has never been recorded correct in the attempt log (it may still show as solved in
   *  Progress, from before WS-1 shipped — see statsByProblem's doc comment). */
  correctWrongAttempts: number | null;
}

/**
 * One pass over the attempt log. Attempts are always appended in chronological order (see
 * attempts.ts), so a plain forward scan that unconditionally overwrites each problem's entry on
 * every matching attempt is already correct — no separate sort or timestamp comparison needed.
 *
 * Not every solved problem has an entry here: Progress.solves predates the WS-1 attempt log (and
 * daily/sprint/training all wrote solves before this burst started), so a problem solved before
 * WS-1 shipped is solved-but-statless. Callers treat that as "typical difficulty, no near-miss
 * signal" rather than requiring it — see hardnessFactor and urgency.
 */
function statsByProblem(attempts: readonly AttemptRecord[]): Map<string, ProblemAttemptStats> {
  const map = new Map<string, ProblemAttemptStats>();
  for (const a of attempts) {
    const existing = map.get(a.problemId) ?? { lastVerdict: null, correctWrongAttempts: null };
    existing.lastVerdict = a.verdictClass;
    if (a.verdictClass === "correct") existing.correctWrongAttempts = a.wrongAttemptsSoFar;
    map.set(a.problemId, existing);
  }
  return map;
}

/**
 * Failure rate per technique (fraction of recorded attempts, on problems in `pool`, tagged with
 * that technique — primary or not — that were not "correct"), scoped to `pool` rather than the
 * whole bank so a single-technique queue's stats reflect that technique specifically. A technique
 * with no recorded attempts yet defaults to 0.4 — a mild, deliberately non-zero assumption so an
 * unpractised technique isn't treated as "mastered" purely for lack of data.
 */
function techniqueFailureRates(pool: readonly Problem[], attempts: readonly AttemptRecord[]): Map<TechniqueId, number> {
  const techniquesById = new Map<string, TechniqueId[]>();
  for (const p of pool) techniquesById.set(p.id, p.techniques);

  const totals = new Map<TechniqueId, { total: number; failed: number }>();
  for (const a of attempts) {
    const techniques = techniquesById.get(a.problemId);
    if (!techniques) continue; // an attempt on a problem outside this pool doesn't inform it
    for (const t of techniques) {
      const cur = totals.get(t) ?? { total: 0, failed: 0 };
      cur.total += 1;
      if (a.verdictClass !== "correct") cur.failed += 1;
      totals.set(t, cur);
    }
  }

  const rates = new Map<TechniqueId, number>();
  for (const [t, { total, failed }] of totals) rates.set(t, total > 0 ? failed / total : 0.4);
  return rates;
}

function hardnessFactor(correctWrongAttempts: number | null): number {
  if (correctWrongAttempts === null) return 1;
  return 1 + Math.min(correctWrongAttempts, HARDNESS_ATTEMPT_CAP) * 0.5;
}

/** Higher = more urgent to serve soon. See the factor list in the section comment above. */
function urgency(
  problem: Problem,
  progress: Progress,
  stats: ProblemAttemptStats | undefined,
  techniqueFailureRate: number,
  now: number,
): number {
  const solve = progress.solves[problem.id];

  if (!solve) {
    const nearMiss = stats?.lastVerdict === "off-by-constant-factor";
    return UNSOLVED_BASE + (nearMiss ? NEAR_MISS_BONUS : 0) + techniqueFailureRate;
  }

  const hardness = hardnessFactor(stats?.correctWrongAttempts ?? null);
  const halfLifeDays = BASE_HALFLIFE_DAYS / hardness;
  const daysSinceSolve = Math.max(0, (now - new Date(solve.solvedAt).getTime()) / MS_PER_DAY);
  const decay = daysSinceSolve / halfLifeDays;
  const weaknessBoost = 1 + techniqueFailureRate * WEAKNESS_GAIN;

  // Clamped below UNSOLVED_BASE so "unsolved beats solved" holds however stale a solve gets.
  return Math.min(decay * weaknessBoost, UNSOLVED_BASE - 1);
}

/**
 * Rough odds of landing this problem if served right now, blending its static difficulty, the
 * technique's own track record, and (when there is one) this specific problem's own history.
 * Bounded away from the extremes — nothing is ever treated as a guaranteed win or a sure loss —
 * since this feeds a ratio, not a hard gate.
 */
function estimatedSuccess(
  problem: Problem,
  stats: ProblemAttemptStats | undefined,
  techniqueFailureRate: number,
  solved: boolean,
): number {
  const difficultyEase = 1 - (problem.difficulty - 1) / 4; // 1.0 at difficulty 1 .. 0.0 at 5
  const techniqueSkill = 1 - techniqueFailureRate;
  let odds = 0.35 + 0.4 * difficultyEase + 0.25 * techniqueSkill;

  if (solved) odds = Math.max(odds, 0.6); // cracked it at least once before
  if (stats?.lastVerdict === "correct") odds = Math.max(odds, 0.75);
  else if (stats?.lastVerdict === "off-by-constant-factor") odds = Math.max(odds, 0.55); // close
  else if (stats?.lastVerdict != null) odds = Math.min(odds, 0.4); // most recent attempt missed outright

  return Math.min(0.97, Math.max(0.05, odds));
}

/**
 * Interleaves two priority-ordered lists so that, over the whole output, roughly `ratio` of what
 * comes out is drawn from `primary` — a fractional (Bresenham-style) accumulator rather than a
 * fixed block pattern, so the blend is spread evenly across the run instead of clumping. Once one
 * side runs out the other drains normally. Always returns exactly `primary.length +
 * secondary.length` items — every element from both inputs, in each one's own relative order.
 */
function interleaveByRatio<T>(primary: readonly T[], secondary: readonly T[], ratio: number): T[] {
  const out: T[] = [];
  let pi = 0;
  let si = 0;
  let credit = 0;
  const total = primary.length + secondary.length;
  for (let i = 0; i < total; i++) {
    credit += ratio;
    if (credit >= 1 && pi < primary.length) {
      out.push(primary[pi++]);
      credit -= 1;
    } else if (si < secondary.length) {
      out.push(secondary[si++]);
    } else {
      out.push(primary[pi++]);
    }
  }
  return out;
}

/**
 * Splits an urgency-ordered list into "comfortable" (estimated odds at or above the target) and
 * "challenging" (below it) and blends them so the served mix nets out near the target success
 * rate instead of leading with whatever is most overdue — see the section comment above. Each
 * band keeps its own urgency order internally, so the single most-due item within a band still
 * comes first once that band's turn comes up.
 */
function shapeToTargetSuccess<T extends { success: number }>(scored: readonly T[], targetSuccess: number): T[] {
  const comfortable = scored.filter((s) => s.success >= targetSuccess);
  const challenging = scored.filter((s) => s.success < targetSuccess);
  return interleaveByRatio(comfortable, challenging, targetSuccess);
}

/**
 * The final pass: reorders so no two consecutive problems share a primary technique
 * (`techniques[0]`) whenever that's achievable at all. Standard greedy for "rearrange so no two
 * adjacent match" — at each step, place a problem from whichever technique still has the most
 * left (breaking ties by that technique's next problem's position in `ordered`, so among equally-
 * pressing techniques the one steps 1-4 ranked more urgent still goes first), skipping only the
 * technique just placed. This is complete whenever a fully clash-free order exists (no technique
 * makes up more than half of what remains at any point) and otherwise still spreads the largest
 * group out as evenly as the supply allows — e.g. 5 problems from one technique and 1 from
 * another can only ever avoid 2 of the 3 unavoidable adjacent repeats, never all 3, no matter the
 * strategy. Always a permutation of `ordered`: every problem is placed exactly once.
 */
function interleaveTechniques(ordered: readonly Problem[]): Problem[] {
  const position = new Map<string, number>();
  ordered.forEach((p, i) => position.set(p.id, i));

  const buckets = new Map<TechniqueId, Problem[]>();
  for (const p of ordered) {
    const bucket = buckets.get(p.techniques[0]);
    if (bucket) bucket.push(p);
    else buckets.set(p.techniques[0], [p]);
  }

  const out: Problem[] = [];
  let lastTechnique: TechniqueId | null = null;
  while (out.length < ordered.length) {
    const candidates = [...buckets.entries()].filter(([, bucket]) => bucket.length > 0);
    candidates.sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length; // most-remaining first
      return (position.get(a[1][0].id) ?? 0) - (position.get(b[1][0].id) ?? 0); // then most-urgent-next first
    });
    const [technique, bucket] = candidates.find(([t]) => t !== lastTechnique) ?? candidates[0];
    out.push(bucket.shift() as Problem);
    lastTechnique = technique;
  }
  return out;
}

/**
 * The real selector: reads the WS-1 attempt log to schedule `pool` by retention decay, per-
 * technique weakness, near-miss priority, a target success band and technique interleaving — see
 * the section comment above for the full model. Same contract as orderQueue: a pure function,
 * meant to be called once and frozen at mount.
 *
 * `orderQueue` stays exported and is what `IntegralTraining.tsx` still calls today — switching
 * that caller over is a deliberate follow-up, not done in the same pass that added this function,
 * because `integration.test.tsx` has two passing tests that hard-code orderQueue's own output as
 * the expected first-served problem; wiring this in would need those tests' fixtures rewritten,
 * which crosses this project's own "don't edit a passing test to make something land" rule. See
 * CLAUDE.md's progress log for the full note.
 */
export function scheduledQueue(
  pool: readonly Problem[],
  progress: Progress,
  attempts: readonly AttemptRecord[],
  now: number = Date.now(),
  targetSuccess: number = TARGET_SUCCESS_DEFAULT,
): Problem[] {
  if (pool.length === 0) return [];

  const stats = statsByProblem(attempts);
  const techFailureRates = techniqueFailureRates(pool, attempts);

  const scored = pool.map((problem) => {
    const problemStats = stats.get(problem.id);
    const failureRate = techFailureRates.get(problem.techniques[0]) ?? 0.4;
    return {
      problem,
      urgency: urgency(problem, progress, problemStats, failureRate, now),
      success: estimatedSuccess(problem, problemStats, failureRate, hasSolved(progress, problem.id)),
    };
  });

  scored.sort((a, b) => b.urgency - a.urgency || a.problem.id.localeCompare(b.problem.id));

  const banded = shapeToTargetSuccess(scored, targetSuccess);
  return interleaveTechniques(banded.map((s) => s.problem));
}
