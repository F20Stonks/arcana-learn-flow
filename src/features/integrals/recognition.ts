/**
 * "Name the weapon" — the recognition drill (WS-6, UK_BEE_BURST.md).
 *
 * Solving fast starts with recognising fast: the accessible ten in a real Round 1 sitting need to
 * land in ~90 seconds each, and picking the right technique on sight is a big share of that budget.
 * This drill isolates exactly that skill — the integrand, four technique buttons, a ~3s clock, no
 * solving — using content that's already fully tagged (`Problem.techniques[0]`), so it needs zero
 * new authorship.
 *
 * Pure logic only; storage lives in `recognitionHistory.ts`, the run in
 * `hooks/useRecognitionRun.ts`.
 */
import { shuffled } from "./rng";
import { PROBLEMS } from "./problems";
import { TECHNIQUES } from "./techniques";
import { confusablesFor } from "./techniqueMap";
import type { Problem, TechniqueId } from "./types";

export const RECOGNITION_ROUND_LENGTH = 20;
export const RECOGNITION_CHOICE_COUNT = 4;
export const RECOGNITION_TIME_LIMIT_MS = 3000;

export interface RecognitionQuestion {
  problem: Problem;
  /** Exactly RECOGNITION_CHOICE_COUNT technique ids, shuffled, containing the correct one once. */
  choices: TechniqueId[];
}

/**
 * RECOGNITION_CHOICE_COUNT - 1 wrong technique ids for `problem`, drawn preferentially from
 * confusablesFor(problem's primary technique) — the technique map's (techniqueMap.ts, WS-11) own
 * family siblings and cross-links — before topping up with a uniformly random pick from whatever's
 * left. A same-family distractor is a real test of discrimination (t-sub vs trig-identity, Gamma vs
 * Beta); a random one (t-sub vs floor-function) is free, per UK_BEE_BURST.md's own framing.
 *
 * Whichever pool a candidate is drawn from, it is never a technique already tagged on `problem` —
 * a problem multi-tagged (e.g. a recurrence problem also tagged wallis-product) never offers one of
 * its own valid tags as a "wrong" choice, which would make the question genuinely ambiguous rather
 * than just hard. This invariant is unchanged from before confusable-preference existed.
 */
export function distractorsFor(problem: Problem, seed: number): TechniqueId[] {
  const needed = RECOGNITION_CHOICE_COUNT - 1;
  const excluded = new Set<TechniqueId>(problem.techniques);

  // Preferred pool: the primary technique's family siblings + cross-links, minus anything already
  // tagged on this problem. Empty for a technique with neither (floor-function, today) — falls
  // straight through to the random-only path below.
  const confusablePool = confusablesFor(problem.techniques[0]).filter((id) => !excluded.has(id));
  const preferred = shuffled(confusablePool, seed).slice(0, needed);
  if (preferred.length >= needed) return preferred;

  // Not enough confusables to fill every slot (including zero) — top up with a uniformly random
  // pick from every technique not already excluded or already chosen as a preferred distractor.
  const chosen = new Set(preferred);
  const randomPool = TECHNIQUES.map((t) => t.id).filter((id) => !excluded.has(id) && !chosen.has(id));
  const filler = shuffled(randomPool, seed + 97).slice(0, needed - preferred.length);
  return [...preferred, ...filler];
}

function questionFor(problem: Problem, seed: number): RecognitionQuestion {
  const correct = problem.techniques[0];
  const distractors = distractorsFor(problem, seed);
  return { problem, choices: shuffled([correct, ...distractors], seed + 1) };
}

/**
 * One round: RECOGNITION_ROUND_LENGTH problems drawn from the whole bank. Seeded by the caller
 * (typically Date.now() — unlike paper mode, a recognition round is meant to be fresh and varied
 * every time, not a repeatable weekly benchmark, so there's no shared weekly seed here).
 */
export function assembleRound(seed: number): RecognitionQuestion[] {
  const chosen = shuffled(PROBLEMS, seed).slice(0, RECOGNITION_ROUND_LENGTH);
  return chosen.map((problem, i) => questionFor(problem, seed * 7919 + i * 104729 + 11));
}

// ── scoring ────────────────────────────────────────────────────────────────────────────────────

export interface RecognitionAttempt {
  id: string;
  /** The problem's primary technique — what was actually being tested. */
  technique: TechniqueId;
  correct: boolean;
  /** Milliseconds from the question appearing to the choice being made; null on a timeout — no
   *  choice was made inside RECOGNITION_TIME_LIMIT_MS. */
  responseMs: number | null;
  at: string;
}

export interface TechniqueRecognitionStats {
  technique: TechniqueId;
  attempts: number;
  correct: number;
  accuracy: number;
  /** Median over non-timeout attempts only — a timeout has no meaningful response time to average
   *  in, and would only ever drag a median down toward the time limit rather than say anything
   *  useful about how fast a correct (or even a fast-but-wrong) pick was. */
  medianResponseMs: number | null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Accuracy and median response time per technique, most-attempted first — the exact pair the
 *  runbook asks this drill to score. */
export function recognitionStatsByTechnique(
  attempts: readonly RecognitionAttempt[],
): TechniqueRecognitionStats[] {
  const byTechnique = new Map<TechniqueId, RecognitionAttempt[]>();
  for (const a of attempts) {
    const list = byTechnique.get(a.technique);
    if (list) list.push(a);
    else byTechnique.set(a.technique, [a]);
  }

  return [...byTechnique.entries()]
    .map(([technique, list]) => {
      const correct = list.filter((a) => a.correct).length;
      const times = list.map((a) => a.responseMs).filter((ms): ms is number => ms !== null);
      return {
        technique,
        attempts: list.length,
        correct,
        accuracy: list.length ? correct / list.length : 0,
        medianResponseMs: median(times),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

export interface RecognitionSummary {
  total: number;
  correct: number;
  accuracy: number;
  medianResponseMs: number | null;
  byTechnique: TechniqueRecognitionStats[];
}

export function summarize(attempts: readonly RecognitionAttempt[]): RecognitionSummary {
  const correct = attempts.filter((a) => a.correct).length;
  const times = attempts.map((a) => a.responseMs).filter((ms): ms is number => ms !== null);
  return {
    total: attempts.length,
    correct,
    accuracy: attempts.length ? correct / attempts.length : 0,
    medianResponseMs: median(times),
    byTechnique: recognitionStatsByTechnique(attempts),
  };
}
