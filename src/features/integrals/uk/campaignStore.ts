/**
 * Campaign persistence — the target date, and a log of which calendar days the competitor showed
 * up and which of that day's steps they finished.
 *
 * campaign.ts is pure (dates in, a plan out) and has no memory of its own; this is that memory.
 * Same localStorage + per-account scoping pattern as attempts.ts: scopedKey, fail-soft when storage
 * is unavailable, a listener set for useSyncExternalStore, and a cache that self-invalidates by
 * re-checking the scoped key on every read — so, exactly as attempts.ts already established, this
 * needs no notification wiring from progress.ts's setProgressScope. A scope change already changes
 * what scopedKey() returns, and the next read here notices.
 *
 * Derived numbers (session count, live streak) are exported as pure functions over an explicit
 * slice of state, not as store getters that re-read the singleton — the same shape progress.ts
 * already uses for techniqueMastery(p, id) and stats(p, date), and it means these are testable
 * without touching localStorage at all.
 */
import { dayKey } from "../daily";
import { nextStreak, scopedKey } from "../progress";
import { DEFAULT_TARGET_DATE, type StepKind } from "./campaign";

const STORAGE_KEY = "arcana.integrals.uk.campaign.v1";

/** Ring-buffer cap on stored session days. One entry per calendar day the competitor ticks
 *  anything, so a ~70-100 day campaign never gets close — this is headroom for years of continued
 *  use afterwards, not a limit anyone training for one Round 1 will ever see. */
export const MAX_SESSION_DAYS = 400;

export interface CampaignSessionRecord {
  dayKey: string;
  completedSteps: StepKind[];
  /** ISO timestamp of the most recent tick on this day. */
  updatedAt: string;
}

export interface CampaignStreak {
  current: number;
  longest: number;
  lastDayKey: string | null;
}

export interface CampaignState {
  version: 1;
  targetDate: string;
  sessions: CampaignSessionRecord[];
  streak: CampaignStreak;
}

function emptyState(): CampaignState {
  return {
    version: 1,
    targetDate: DEFAULT_TARGET_DATE,
    sessions: [],
    streak: { current: 0, longest: 0, lastDayKey: null },
  };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

let memory: CampaignState | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): CampaignState {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyState(), ...(JSON.parse(raw) as CampaignState) } : emptyState();
  } catch {
    memory = emptyState();
  }
  memoryKey = key;
  return memory;
}

function write(next: CampaignState) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the session.
  }
  for (const l of listeners) l();
}

export function subscribeCampaign(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCampaignState(): CampaignState {
  return read();
}

/** Tests, and a possible future settings screen, alongside resetProgress/resetAttempts. */
export function resetCampaign() {
  write(emptyState());
}

// ── target date ────────────────────────────────────────────────────────────────────────────────

/**
 * Advisory only: campaign.ts already treats every consumer of DEFAULT_TARGET_DATE as a default the
 * competitor overrides, never as a fact, and this does not validate the string beyond what the
 * caller (a date input) already guarantees. Round 1 is host-dependent and the competitor is the one
 * confirming it — this module's job is to remember what they said, not to police it.
 */
export function setTargetDate(date: string) {
  write({ ...read(), targetDate: date });
}

// ── session ticks ──────────────────────────────────────────────────────────────────────────────

/** Pure — whether `step` is among the steps already ticked for `day`. Takes the sessions slice
 *  explicitly so it can be checked against a snapshot without re-reading the store. */
export function stepIsComplete(
  sessions: CampaignSessionRecord[],
  day: string,
  step: StepKind,
): boolean {
  return sessions.find((s) => s.dayKey === day)?.completedSteps.includes(step) ?? false;
}

/** Pure — a day counts as "shown up" once at least one of its steps has been ticked. */
export function sessionsCompletedCount(sessions: CampaignSessionRecord[]): number {
  return sessions.filter((s) => s.completedSteps.length > 0).length;
}

/**
 * Pure — the streak as of `today`. A streak not extended yesterday is already dead even though
 * nothing writes to storage until the next tick, so — same "live" pattern as progress.ts's
 * liveStreak — this has to work it out rather than trust the stored `current` blindly.
 */
export function liveCampaignStreak(streak: CampaignStreak, today = new Date()): number {
  const { current, lastDayKey } = streak;
  if (!lastDayKey) return 0;
  const todayKey = dayKey(today);
  if (lastDayKey === todayKey) return current;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastDayKey === dayKey(yesterday)) return current;
  return 0;
}

/**
 * Flips one step of one day's session. Ticking extends the adherence streak the same way a daily
 * solve extends progress.ts's streak (reusing nextStreak directly — the calendar arithmetic is
 * already right and tested there, no reason to re-derive it). Unticking does not roll the streak
 * back: the adherence signal is "did you show up today," and a step ticked and then undone in the
 * same session still means the session was opened and worked at least once. Idempotent either way
 * — calling this twice in a row just toggles back.
 */
export function toggleStep(day: string, step: StepKind, at: Date = new Date()) {
  const log = read();
  const done = stepIsComplete(log.sessions, day, step);

  if (done) {
    const sessions = log.sessions.map((s) =>
      s.dayKey === day ? { ...s, completedSteps: s.completedSteps.filter((k) => k !== step) } : s,
    );
    write({ ...log, sessions });
    return;
  }

  const existing = log.sessions.find((s) => s.dayKey === day);
  const sessions = existing
    ? log.sessions.map((s) =>
        s.dayKey === day
          ? { ...s, completedSteps: [...s.completedSteps, step], updatedAt: at.toISOString() }
          : s,
      )
    : [...log.sessions, { dayKey: day, completedSteps: [step], updatedAt: at.toISOString() }];
  const trimmed =
    sessions.length > MAX_SESSION_DAYS ? sessions.slice(sessions.length - MAX_SESSION_DAYS) : sessions;

  write({ ...log, sessions: trimmed, streak: nextStreak(log.streak, day) });
}
