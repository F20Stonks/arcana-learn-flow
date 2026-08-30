/**
 * Spaced concept review — the third piece of WS-10, deep absorption (see UK_BEE_BURST.md).
 *
 * Problems are already spaced by WS-4's `scheduledQueue` (queue.ts), weighing retention decay per
 * PROBLEM. Nothing plays the same role for IDEAS: a lesson read once in week 2 is never resurfaced
 * except incidentally, through whichever problems happen to come up. This module is that memory —
 * one lightweight record per technique, tracking when its lesson was last read and on what expanding
 * schedule it comes due again.
 *
 * `progress.ts` already has `lessonsRead: TechniqueId[]`, but it's a plain set with no timestamp —
 * exactly enough for the "read" checkmark and the Scholar badge, nothing a spacing schedule could be
 * built on. Rather than widen `Progress` (every other WS-1-onward store — attempts.ts, campaignStore
 * .ts, recognitionHistory.ts — deliberately keeps its own key instead, so `Progress`'s own migration
 * path in progress.ts stays untouched by anything added later), this is a parallel, timestamped store
 * with the same localStorage + per-account scoping pattern as attempts.ts: scopedKey, fail-soft when
 * storage is unavailable, a listener set for useSyncExternalStore, and a cache that self-invalidates
 * by re-checking the scoped key on every read — so, as with every store since attempts.ts, this needs
 * no notification wiring from progress.ts's setProgressScope.
 *
 * No ring-buffer cap here, unlike attempts.ts/campaignStore.ts: this store holds at most one record
 * per TechniqueId, a fixed union of 21 — it cannot grow without bound the way a per-submission or
 * per-session log can.
 *
 * The schedule is a simple expanding interval (a light Leitner-box shape), not a full SRS — recorded
 * reads are deduplicated to one per calendar day (opening a lesson panel five times in one training
 * session is one engagement, not five), and the stage only advances (spacing widens) when a read
 * happens ON OR AFTER the technique's own due day: reading early — out of curiosity, or because
 * training's lesson panel got opened mid-drill — updates when it was last seen without disturbing the
 * schedule already in flight, so incidental engagement can't trivially inflate the interval.
 */
import { dayIndex, dayKey } from "./daily";
import { scopedKey } from "./progress";
import { TECHNIQUE_BY_ID, TECHNIQUES } from "./techniques";
import type { Technique, TechniqueId } from "./types";

const STORAGE_KEY = "arcana.integrals.conceptReview.v1";

/** Days until a technique comes due again, indexed by how many successful reviews it's already had.
 *  Expanding — each on-time review pushes the next one further out — and caps at the last entry
 *  rather than growing forever, so a well-known technique still gets touched roughly every two
 *  months instead of drifting out of rotation entirely. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;

export interface ConceptReviewRecord {
  /** Calendar day (dayKey) this technique's lesson was last read — display and same-day dedupe. */
  lastReadDayKey: string;
  lastReadAt: string;
  /** Index into REVIEW_INTERVALS_DAYS: how far the spacing has widened so far. 0 after the first
   *  read; advances by one each time a read lands on or after the technique's own due day. */
  stage: number;
  /** dayIndex() (see daily.ts) this technique becomes due again. */
  dueDayIndex: number;
}

interface ConceptReviewLog {
  version: 1;
  records: Partial<Record<TechniqueId, ConceptReviewRecord>>;
}

function emptyLog(): ConceptReviewLog {
  return { version: 1, records: {} };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

let memory: ConceptReviewLog | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): ConceptReviewLog {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyLog(), ...(JSON.parse(raw) as ConceptReviewLog) } : emptyLog();
  } catch {
    memory = emptyLog();
  }
  memoryKey = key;
  return memory;
}

function write(next: ConceptReviewLog) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the read.
  }
  for (const l of listeners) l();
}

export function subscribeConceptReview(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getConceptReviewRecords(): Partial<Record<TechniqueId, ConceptReviewRecord>> {
  return read().records;
}

/** Tests, and a possible future settings screen, alongside resetProgress/resetAttempts. */
export function resetConceptReview() {
  write(emptyLog());
}

// ── recording ──────────────────────────────────────────────────────────────────────────────────

/**
 * Call whenever a technique's lesson is actually opened — training's lesson panel and the standalone
 * Lessons library both already call progress.ts's markLessonRead at exactly the right moment, so this
 * is called alongside it rather than from inside progress.ts (keeping that store's migration path,
 * and this module's storage, independent — see the file doc comment).
 *
 * A second call on the same calendar day is a no-op: same-day engagement (re-opening a lesson panel
 * across a few problems in one sitting) is one read, not several, and must not be able to advance the
 * schedule on its own.
 */
export function recordConceptRead(id: TechniqueId, at: Date = new Date()): void {
  const log = read();
  const today = dayKey(at);
  const existing = log.records[id];

  if (existing?.lastReadDayKey === today) return;

  let next: ConceptReviewRecord;
  if (!existing) {
    const todayIndex = dayIndex(at);
    next = {
      lastReadDayKey: today,
      lastReadAt: at.toISOString(),
      stage: 0,
      dueDayIndex: todayIndex + REVIEW_INTERVALS_DAYS[0],
    };
  } else {
    const todayIndex = dayIndex(at);
    const wasDue = todayIndex >= existing.dueDayIndex;
    const stage = wasDue
      ? Math.min(existing.stage + 1, REVIEW_INTERVALS_DAYS.length - 1)
      : existing.stage;
    const dueDayIndex = wasDue ? todayIndex + REVIEW_INTERVALS_DAYS[stage] : existing.dueDayIndex;
    next = { lastReadDayKey: today, lastReadAt: at.toISOString(), stage, dueDayIndex };
  }

  write({ ...log, records: { ...log.records, [id]: next } });
}

// ── derived ────────────────────────────────────────────────────────────────────────────────────

/** Pure — 0 on the day it becomes due, positive once it's overdue. Takes the record explicitly so it
 *  can be checked against a snapshot without re-reading the store. */
export function daysOverdue(record: ConceptReviewRecord, now: Date = new Date()): number {
  return dayIndex(now) - record.dueDayIndex;
}

/** A technique that's never been read is not "due" — it's simply new, and breadth coverage (the
 *  scheduler, the campaign's breadth block) already owns surfacing those. Due-for-review is
 *  specifically about previously-read material that's had time to fade. */
export function isDue(record: ConceptReviewRecord | undefined, now: Date = new Date()): boolean {
  return record !== undefined && daysOverdue(record, now) >= 0;
}

/** Every technique currently due, most-overdue first; ties broken by curriculum order. */
export function dueForReview(now: Date = new Date()): TechniqueId[] {
  const records = read().records;
  return TECHNIQUES.map((t) => t.id)
    .filter((id) => isDue(records[id], now))
    .sort((a, b) => daysOverdue(records[b]!, now) - daysOverdue(records[a]!, now));
}

export interface ConceptReviewStep {
  techniqueId: TechniqueId;
  technique: Technique;
  daysOverdue: number;
}

/**
 * The single most-overdue technique, ready for a consumer to render as a review prompt — the
 * "concept review" step UK_BEE_BURST.md's WS-10 asks for, sized so the campaign's `planSession` (see
 * uk/campaign.ts) can eventually slot it in as one more `SessionStep`. Deliberately NOT wired into
 * planSession by this module: that decision needs real judgment about session composition (which
 * block it belongs in, how it interacts with the taper block's "no new material" rule, whether it
 * ever bumps something else out of a day that's already full) that this module has no business making
 * unilaterally — see the progress log for the follow-up this leaves for the owner. Returns plain data
 * (a TechniqueId and the Technique itself), not a uk/campaign.ts SessionStep, so this module never
 * needs to import from the uk/ subtree — every existing dependency runs the other way.
 */
export function conceptReviewStep(now: Date = new Date()): ConceptReviewStep | null {
  const due = dueForReview(now);
  if (due.length === 0) return null;
  const id = due[0];
  const record = read().records[id];
  if (!record) return null; // unreachable given dueForReview's own filter — kept for type safety
  return { techniqueId: id, technique: TECHNIQUE_BY_ID[id], daysOverdue: daysOverdue(record, now) };
}
