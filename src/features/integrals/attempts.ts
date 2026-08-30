/**
 * Attempt log — every submission, not just every solve.
 *
 * progress.ts keeps one record per problem (the latest/best solve); a wrong attempt there is only
 * ever a counter increment, and the string the student actually typed is thrown away the instant
 * the verdict is shown. That is fine for XP and mastery, but it means seventy days of training
 * would leave no evidence of *how* a student got things wrong — nothing for an error taxonomy to
 * classify, nothing for a scheduler to weigh. This module is that evidence: one row per submission,
 * across every mode, correct or not.
 *
 * Same localStorage + per-account scoping as progress.ts (scopedKey, fail-soft when storage is
 * unavailable) — but its own key. `Progress` itself is not widened, so its existing migration path
 * (see migrateDailyRecord in progress.ts) stays untouched by anything in here.
 */
import { scopedKey } from "./progress";
import type { Verdict } from "./types";

const STORAGE_KEY = "arcana.integrals.attempts.v1";

/** Ring-buffer cap — months of daily training fit comfortably under this; localStorage can't be
 *  filled by an account that's been running a long time. */
export const MAX_ATTEMPTS = 5000;

export type RunMode = "training" | "daily" | "sprint" | "paper" | "headsolve";

/** The coarse class a submission landed in — mirrors Verdict["status"] exactly, so a consumer can
 *  always resolve a stored attempt back against the live Verdict type. */
export type VerdictClass = Verdict["status"];

export interface AttemptRecord {
  id: string;
  problemId: string;
  mode: RunMode;
  /** ISO timestamp of the submission. */
  at: string;
  verdictClass: VerdictClass;
  /** The raw string the student submitted — typed or built via the palette, before normalize(). */
  submitted: string;
  /** Hints open on the problem at the moment of this submission. */
  hintsOpen: number;
  /** Wrong attempts already made on this same problem, in this same run, before this one. */
  wrongAttemptsSoFar: number;
  /** Problem-appears → first-keystroke, ms. The "did you even know where to start" clock.
   *  Null only when this attempt's run never captured a start (shouldn't happen in practice, since
   *  a submission requires text, which requires a keystroke — kept nullable defensively rather
   *  than asserted, so a future caller can't be crashed by an edge case in an older client). */
  msToFirstKeystroke: number | null;
  /** First-keystroke → this submission, ms. The "how long did the algebra/typing take" clock. */
  msFirstKeystrokeToSubmit: number | null;
}

interface AttemptLog {
  version: 1;
  attempts: AttemptRecord[];
}

function emptyLog(): AttemptLog {
  return { version: 1, attempts: [] };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────
//
// Same fail-soft, scoped pattern as progress.ts, but the cache invalidates itself: every read
// recomputes the current scoped key and only trusts the cached log when that key hasn't moved.
// That means this module needs no notification from progress.ts's own setProgressScope — a scope
// change already changes what scopedKey(STORAGE_KEY) returns, and the next read here notices.

let memory: AttemptLog | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): AttemptLog {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyLog(), ...(JSON.parse(raw) as AttemptLog) } : emptyLog();
  } catch {
    memory = emptyLog();
  }
  memoryKey = key;
  return memory;
}

function write(next: AttemptLog) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the run's evidence.
  }
  for (const l of listeners) l();
}

export function subscribeAttempts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAttempts(): AttemptRecord[] {
  return read().attempts;
}

export function attemptsForProblem(problemId: string): AttemptRecord[] {
  return read().attempts.filter((a) => a.problemId === problemId);
}

/** Tests, and (eventually) a settings screen, alongside resetProgress. */
export function resetAttempts() {
  write(emptyLog());
}

// ── recording ──────────────────────────────────────────────────────────────────────────────────

export interface RecordAttemptInput {
  problemId: string;
  mode: RunMode;
  verdictClass: VerdictClass;
  submitted: string;
  hintsOpen: number;
  wrongAttemptsSoFar: number;
  msToFirstKeystroke: number | null;
  msFirstKeystrokeToSubmit: number | null;
  /** Defaults to now; only ever overridden by tests. */
  at?: Date;
}

let ordinal = 0;

/**
 * Appends one attempt to the log and enforces the ring-buffer cap. Every submission counts,
 * correct or not — a wrong answer's submitted string is exactly the raw material an error
 * taxonomy or a scheduler needs, and today (before this module) it was discarded the instant the
 * verdict was shown.
 */
export function recordAttempt(input: RecordAttemptInput): AttemptRecord {
  const at = input.at ?? new Date();
  ordinal = (ordinal + 1) % 1_000_000;
  const record: AttemptRecord = {
    id: `${input.problemId}:${at.getTime()}:${ordinal}`,
    problemId: input.problemId,
    mode: input.mode,
    at: at.toISOString(),
    verdictClass: input.verdictClass,
    submitted: input.submitted,
    hintsOpen: input.hintsOpen,
    wrongAttemptsSoFar: input.wrongAttemptsSoFar,
    msToFirstKeystroke: input.msToFirstKeystroke,
    msFirstKeystrokeToSubmit: input.msFirstKeystrokeToSubmit,
  };
  const log = read();
  const attempts = [...log.attempts, record];
  const trimmed =
    attempts.length > MAX_ATTEMPTS ? attempts.slice(attempts.length - MAX_ATTEMPTS) : attempts;
  write({ ...log, attempts: trimmed });
  return record;
}
