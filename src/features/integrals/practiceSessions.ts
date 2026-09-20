/**
 * Saved practice sessions — named bookmarks of a filter over the problem bank.
 *
 * The database page (`IntegralDatabase.tsx`) already lets a student narrow the bank down to any
 * technique/source/difficulty combination and start drilling it once. This is the difference
 * between that and something you can actually work through over weeks: a name, a place to come
 * back to it, and (via `progress.ts`'s existing per-problem solves) a live sense of how much of it
 * is left — "the MIT archive," "everything I haven't solved yet," "SPLASH, difficulty 4-5 only."
 *
 * Same localStorage + per-account scoping pattern as every store since `attempts.ts`: `scopedKey`,
 * fail-soft when storage is unavailable, a listener set for `useSyncExternalStore`, a cache that
 * self-invalidates by re-checking the scoped key on every read. No ring-buffer cap — a student
 * building sessions by hand isn't going to create thousands of them, unlike a per-submission log.
 */
import { scopedKey } from "./progress";
import type { ProblemFilter } from "./problems";

const STORAGE_KEY = "arcana.integrals.practiceSessions.v1";

export interface PracticeSession {
  id: string;
  name: string;
  createdAt: string;
  filter: ProblemFilter;
  /** Unsolved-only is a live, progress-dependent condition, so it's stored as its own flag rather
   *  than baked into `filter` — `problemsForFilter` itself has no notion of solve state. */
  unsolvedOnly: boolean;
}

interface SessionLog {
  version: 1;
  sessions: PracticeSession[];
}

function emptyLog(): SessionLog {
  return { version: 1, sessions: [] };
}

let memory: SessionLog | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): SessionLog {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyLog(), ...(JSON.parse(raw) as SessionLog) } : emptyLog();
  } catch {
    memory = emptyLog();
  }
  memoryKey = key;
  return memory;
}

function write(next: SessionLog) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the session for this run.
  }
  for (const l of listeners) l();
}

export function subscribePracticeSessions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPracticeSessions(): PracticeSession[] {
  return read().sessions;
}

let ordinal = 0;

export function savePracticeSession(name: string, filter: ProblemFilter, unsolvedOnly: boolean): PracticeSession {
  ordinal = (ordinal + 1) % 1_000_000;
  const session: PracticeSession = {
    id: `session:${Date.now()}:${ordinal}`,
    name,
    createdAt: new Date().toISOString(),
    filter,
    unsolvedOnly,
  };
  write({ ...read(), sessions: [...read().sessions, session] });
  return session;
}

export function deletePracticeSession(id: string): void {
  write({ ...read(), sessions: read().sessions.filter((s) => s.id !== id) });
}

export function renamePracticeSession(id: string, name: string): void {
  write({ ...read(), sessions: read().sessions.map((s) => (s.id === id ? { ...s, name } : s)) });
}

/** Tests, and a possible future settings screen, alongside resetProgress/resetAttempts. */
export function resetPracticeSessions(): void {
  write(emptyLog());
}
