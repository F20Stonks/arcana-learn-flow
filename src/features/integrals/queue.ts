import { hasSolved, type Progress } from "./progress";
import type { Problem } from "./types";

/**
 * Practice order: unsolved first, easiest first inside each half. Callers freeze the result at
 * mount — re-sorting as you solve would move the queue out from under you mid-session.
 */
export function orderQueue(pool: Problem[], progress: Progress): Problem[] {
  const rank = (p: Problem) => (hasSolved(progress, p.id) ? 100 : 0) + p.difficulty;
  return pool.slice().sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}
