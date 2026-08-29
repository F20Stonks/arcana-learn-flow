/**
 * Recognition drill history — every "name the weapon" pick, correct or not, so accuracy and
 * median response time per technique (what the runbook actually asks this drill to score) can be
 * computed from real evidence instead of a single last-round snapshot.
 *
 * Same localStorage + per-account scoping pattern as attempts.ts (scopedKey, fail-soft when
 * storage is unavailable, ring-buffer cap) — its own key and cap, not folded into attempts.ts:
 * a recognition pick isn't an integral-answer submission (no verdictClass, no submitted
 * expression, no hints), so forcing it into AttemptRecord's shape would mean padding out fields
 * that don't apply rather than adding a clean, separate log.
 */
import { scopedKey } from "./progress";
import type { RecognitionAttempt } from "./recognition";

const STORAGE_KEY = "arcana.integrals.recognition.v1";

/** Recognition rounds are quick (20 picks in under a minute of drilling), so this fills faster
 *  than the integral attempt log's cap — still comfortably enough for months of regular use. */
export const MAX_RECOGNITION_ATTEMPTS = 4000;

interface RecognitionLog {
  version: 1;
  attempts: RecognitionAttempt[];
}

function emptyLog(): RecognitionLog {
  return { version: 1, attempts: [] };
}

let memory: RecognitionLog | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): RecognitionLog {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyLog(), ...(JSON.parse(raw) as RecognitionLog) } : emptyLog();
  } catch {
    memory = emptyLog();
  }
  memoryKey = key;
  return memory;
}

function write(next: RecognitionLog) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the round's evidence.
  }
  for (const l of listeners) l();
}

export function subscribeRecognitionAttempts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRecognitionAttempts(): RecognitionAttempt[] {
  return read().attempts;
}

/** Tests, and a possible future settings screen, alongside resetAttempts/resetProgress. */
export function resetRecognitionAttempts() {
  write(emptyLog());
}

export interface RecordRecognitionAttemptInput {
  technique: RecognitionAttempt["technique"];
  correct: boolean;
  responseMs: number | null;
  /** Defaults to now; only ever overridden by tests. */
  at?: Date;
}

let ordinal = 0;

export function recordRecognitionAttempt(input: RecordRecognitionAttemptInput): RecognitionAttempt {
  const at = input.at ?? new Date();
  ordinal = (ordinal + 1) % 1_000_000;
  const record: RecognitionAttempt = {
    id: `${input.technique}:${at.getTime()}:${ordinal}`,
    technique: input.technique,
    correct: input.correct,
    responseMs: input.responseMs,
    at: at.toISOString(),
  };
  const log = read();
  const attempts = [...log.attempts, record];
  const trimmed =
    attempts.length > MAX_RECOGNITION_ATTEMPTS
      ? attempts.slice(attempts.length - MAX_RECOGNITION_ATTEMPTS)
      : attempts;
  write({ ...log, attempts: trimmed });
  return record;
}
