/**
 * UK Round 1 paper results — the weekly benchmark's own history, plus a live in-progress snapshot
 * so a 120-minute sitting survives an accidental reload.
 *
 * Same localStorage + per-account scoping pattern as progress.ts/attempts.ts (scopedKey, fail-soft
 * when storage is unavailable, cache self-invalidates by re-checking scopedKey on every read — see
 * attempts.ts for why that avoids needing any change to progress.ts itself). Two separate keys, not
 * one: history is small and append-only, the snapshot is large and rewritten constantly while a
 * paper is live — mixing them would mean rewriting the whole history on every clock tick.
 */
import { scopedKey } from "../progress";
import type { PaperBandId } from "./paper";

const HISTORY_KEY = "arcana.integrals.uk.paperHistory.v1";
const SNAPSHOT_KEY = "arcana.integrals.uk.paperSnapshot.v1";

export interface PaperBandResult {
  bandId: PaperBandId;
  correct: number;
  total: number;
  /** Summed focus time across every question in this band. */
  secondsSpent: number;
}

export type PaperEndReason = "submitted" | "time-up";

export interface PaperResult {
  id: string;
  seed: number;
  startedAt: string;
  finishedAt: string;
  endReason: PaperEndReason;
  /** Correct out of `total` — real competition marking, not XP. */
  score: number;
  total: number;
  bands: PaperBandResult[];
  /** Summed focus time on every question that never ended up correct — the triage cost: time paid
   *  for a question that, in the end, didn't land. */
  triageSeconds: number;
  /** Total time elapsed in the sitting (paused time excluded), <= PAPER_SECONDS. */
  secondsUsed: number;
}

export type PaperSlotStatus = "unattempted" | "attempted" | "correct";

export interface PaperSlotSnapshot {
  problemId: string;
  input: string;
  status: PaperSlotStatus;
  flagged: boolean;
  wrongAttempts: number;
  secondsSpent: number;
}

/** Enough to fully reconstruct a live run after a reload: which paper, where the clock and cursor
 *  were, and every slot's own state. */
export interface PaperRunSnapshot {
  seed: number;
  startedAt: string;
  remainingSeconds: number;
  paused: boolean;
  currentIndex: number;
  slots: PaperSlotSnapshot[];
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

interface Store<T> {
  memory: T | null;
  memoryKey: string | null;
}

function makeStore<T>(): Store<T> {
  return { memory: null, memoryKey: null };
}

function read<T>(store: Store<T>, key: string, fallback: () => T): T {
  const scoped = scopedKey(key);
  if (store.memory !== null && store.memoryKey === scoped) return store.memory;
  try {
    const raw = globalThis.localStorage?.getItem(scoped);
    store.memory = raw ? (JSON.parse(raw) as T) : fallback();
  } catch {
    store.memory = fallback();
  }
  store.memoryKey = scoped;
  return store.memory;
}

function write<T>(store: Store<T>, key: string, value: T) {
  const scoped = scopedKey(key);
  store.memory = value;
  store.memoryKey = scoped;
  try {
    globalThis.localStorage?.setItem(scoped, JSON.stringify(value));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the run.
  }
}

function clear<T>(store: Store<T>, key: string) {
  const scoped = scopedKey(key);
  store.memory = null;
  store.memoryKey = scoped;
  try {
    globalThis.localStorage?.removeItem(scoped);
  } catch {
    // Storage is unavailable — nothing to clear.
  }
}

// ── history ────────────────────────────────────────────────────────────────────────────────────

const historyStore = makeStore<PaperResult[]>();

export function getPaperHistory(): PaperResult[] {
  return read(historyStore, HISTORY_KEY, () => []);
}

let ordinal = 0;

export function recordPaperResult(result: Omit<PaperResult, "id">): PaperResult {
  ordinal = (ordinal + 1) % 1_000_000;
  const withId: PaperResult = { ...result, id: `paper:${Date.now()}:${ordinal}` };
  write(historyStore, HISTORY_KEY, [...getPaperHistory(), withId]);
  return withId;
}

/** Tests, and a possible future settings screen. */
export function resetPaperHistory() {
  write(historyStore, HISTORY_KEY, []);
}

/** Most recent sitting for a given week's seed, if the student has taken that week's paper. */
export function paperResultForSeed(seed: number): PaperResult | undefined {
  const matches = getPaperHistory().filter((r) => r.seed === seed);
  return matches[matches.length - 1];
}

// ── live snapshot ──────────────────────────────────────────────────────────────────────────────

const snapshotStore = makeStore<PaperRunSnapshot | null>();

export function getPaperSnapshot(): PaperRunSnapshot | null {
  return read(snapshotStore, SNAPSHOT_KEY, () => null);
}

export function savePaperSnapshot(snapshot: PaperRunSnapshot) {
  write(snapshotStore, SNAPSHOT_KEY, snapshot);
}

export function clearPaperSnapshot() {
  clear(snapshotStore, SNAPSHOT_KEY);
}
