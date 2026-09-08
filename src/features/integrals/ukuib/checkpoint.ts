/**
 * Unit checkpoints — the test that proves a unit, and the one that lets you skip it.
 *
 * Ten problems drawn only from that unit's own techniques, no hints, no teaching. Pass at 70% and
 * the next unit opens. Crucially a checkpoint is available *before* you have done the unit, which
 * is the "jump here" affordance: someone who already integrates by parts in their sleep should not
 * have to grind five crowns of Foundations to reach Gamma, and making them would teach them
 * nothing except that this app wastes their time.
 *
 * Pure and seeded, like lesson.ts — a checkpoint you failed and are retrying is the same ten
 * problems, so the retry measures you rather than the draw.
 */
import type { Difficulty, Problem } from "../types";
import { PROBLEMS, problemsForTechniques } from "../problems";
import { shuffled } from "../rng";
import { UNIT_BY_ID, type UnitId } from "./curriculum";

export const CHECKPOINT_LENGTH = 10;

export interface CheckpointPlan {
  unitId: UnitId;
  problems: Problem[];
}

/**
 * Spread the ten across the difficulty range rather than taking the ten easiest: a checkpoint that
 * only ever asks warm-ups proves nothing, and one that only asks brutal ones is a wall. Three from
 * the easy end, four from the middle, three from the hard end — falling back to whatever the unit's
 * pool actually has when a band is thin (a one-skill unit like Discontinuous integrands has a much
 * narrower spread than Foundations, and should still produce a full checkpoint).
 */
function stratify(pool: readonly Problem[], seed: number): Problem[] {
  const bands: Array<[Difficulty[], number]> = [
    [[1, 2], 3],
    [[3], 4],
    [[4, 5], 3],
  ];
  const chosen: Problem[] = [];
  const used = new Set<string>();
  for (const [band, want] of bands) {
    const inBand = shuffled(
      pool.filter((p) => band.includes(p.difficulty) && !used.has(p.id)),
      seed + band[0] * 977,
    );
    for (const p of inBand.slice(0, want)) {
      chosen.push(p);
      used.add(p.id);
    }
  }
  // Top up from anything left if a band came up short.
  if (chosen.length < CHECKPOINT_LENGTH) {
    for (const p of shuffled(pool, seed + 13)) {
      if (used.has(p.id)) continue;
      chosen.push(p);
      used.add(p.id);
      if (chosen.length === CHECKPOINT_LENGTH) break;
    }
  }
  return shuffled(chosen.slice(0, CHECKPOINT_LENGTH), seed + 61);
}

export function planCheckpoint(unitId: UnitId, seed: number): CheckpointPlan {
  const unit = UNIT_BY_ID[unitId];
  if (!unit) return { unitId, problems: [] };
  const techniques = unit.skills.flatMap((s) => (s.technique ? [s.technique] : []));
  // The finale unit has no techniques of its own; its checkpoint is the whole bank, which is
  // exactly what sitting the real thing is like.
  const pool = techniques.length > 0 ? problemsForTechniques(techniques) : PROBLEMS;
  return { unitId, problems: stratify(pool, seed) };
}

/** A checkpoint is only worth offering if its unit's techniques actually have problems yet. */
export function checkpointReady(unitId: UnitId): boolean {
  return planCheckpoint(unitId, 1).problems.length >= CHECKPOINT_LENGTH;
}
