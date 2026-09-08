/**
 * Cross-device sync for Integral Arena progress.
 *
 * Every store in this feature is localStorage-first and fail-soft, which is right for play (a solve
 * must never block on the network) but wrong for a player who owns two devices. This module adds a
 * cloud copy on top without changing a single caller: on sign-in it pulls the account's saved blob,
 * merges it with whatever is on this device, writes the merged result back locally, and pushes the
 * result up. After that every local write schedules a debounced push.
 *
 * Merge rules are deliberately "nothing is ever lost":
 *   - counters that only go up (xp, streak longest, solve counts, sprint bests) take the max
 *   - per-problem records take the better one (more solves, faster best time, hints-free wins)
 *   - sets (badges, lessons read, daily records, bookmarks) union, remote losing ties
 * so two devices played offline in parallel merge instead of clobbering each other.
 *
 * Secondary stores (attempts, headsolve, recognition, paper history, campaign, concept review) ride
 * along as opaque JSON in the same row under `extras`. They are append-only logs whose merge would
 * need per-store knowledge; the pragmatic rule is "whichever side has more, wins", which is correct
 * for a log that only grows and harmless for the rest.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  emptyProgress,
  getProgress,
  replaceProgress,
  subscribe,
  type DailyRecord,
  type Progress,
  type SolveRecord,
  type SprintBest,
} from "./progress";

/** localStorage keys that ride along as opaque blobs. Base keys — scoping is applied per account. */
export const EXTRA_KEYS = [
  "arcana.integrals.attempts.v1",
  "arcana.integrals.headsolve.v1",
  "arcana.integrals.recognition.v1",
  "arcana.integrals.conceptReview.v1",
  "arcana.integrals.uk.paperHistory.v1",
  "arcana.integrals.uk.campaign.v1",
] as const;

const PUSH_DEBOUNCE_MS = 2500;

type Extras = Record<string, unknown>;

export type SyncStatus = "idle" | "syncing" | "synced" | "offline";

let status: SyncStatus = "idle";
let currentUser: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeLocal: (() => void) | null = null;
const statusListeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  for (const l of statusListeners) l();
}

// ── merging ────────────────────────────────────────────────────────────────────────────────────

function mergeSolve(a: SolveRecord | undefined, b: SolveRecord | undefined): SolveRecord {
  if (!a) return b!;
  if (!b) return a;
  return {
    solvedAt: a.solvedAt > b.solvedAt ? a.solvedAt : b.solvedAt,
    solves: Math.max(a.solves, b.solves),
    bestSeconds: Math.min(a.bestSeconds, b.bestSeconds),
    everSolvedWithoutHints: a.everSolvedWithoutHints || b.everSolvedWithoutHints,
  };
}

function mergeDaily(a: DailyRecord | undefined, b: DailyRecord | undefined): DailyRecord {
  if (!a) return b!;
  if (!b) return a;
  // The better sitting wins outright — a day is one attempt, not an aggregate.
  return b.score > a.score ? b : a;
}

function mergeSprint(a: SprintBest | undefined, b: SprintBest | undefined): SprintBest {
  if (!a) return b!;
  if (!b) return a;
  return {
    score: Math.max(a.score, b.score),
    solved: Math.max(a.solved, b.solved),
    runs: Math.max(a.runs, b.runs),
    at: a.score >= b.score ? a.at : b.at,
  };
}

function mergeRecords<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  pick: (x: T | undefined, y: T | undefined) => T,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    out[key] = pick(a?.[key], b?.[key]);
  }
  return out;
}

/** Exported for the test suite — this is the part that must never lose a solve. */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const base = emptyProgress();
  return {
    ...base,
    version: 1,
    xp: Math.max(local.xp ?? 0, remote.xp ?? 0),
    solves: mergeRecords(local.solves ?? {}, remote.solves ?? {}, mergeSolve),
    daily: mergeRecords(local.daily ?? {}, remote.daily ?? {}, mergeDaily),
    solveDays: mergeRecords(local.solveDays ?? {}, remote.solveDays ?? {}, (x, y) =>
      Math.max(x ?? 0, y ?? 0),
    ),
    sprints: mergeRecords(local.sprints ?? {}, remote.sprints ?? {}, mergeSprint),
    streak: {
      current: Math.max(local.streak?.current ?? 0, remote.streak?.current ?? 0),
      longest: Math.max(local.streak?.longest ?? 0, remote.streak?.longest ?? 0),
      lastDayKey:
        (local.streak?.lastDayKey ?? "") >= (remote.streak?.lastDayKey ?? "")
          ? local.streak?.lastDayKey ?? null
          : remote.streak?.lastDayKey ?? null,
    },
    badges: { ...(remote.badges ?? {}), ...(local.badges ?? {}) },
    lessonsRead: Array.from(new Set([...(remote.lessonsRead ?? []), ...(local.lessonsRead ?? [])])),
    bookmarks: { ...(remote.bookmarks ?? {}), ...(local.bookmarks ?? {}) },
  };
}

// ── extras ─────────────────────────────────────────────────────────────────────────────────────

function scoped(base: string): string {
  return currentUser ? `${base}:${currentUser}` : base;
}

function readExtras(): Extras {
  const out: Extras = {};
  for (const key of EXTRA_KEYS) {
    try {
      const raw = globalThis.localStorage?.getItem(scoped(key));
      if (raw) out[key] = JSON.parse(raw);
    } catch {
      // A corrupt blob is simply not synced; the local store already handles its own recovery.
    }
  }
  return out;
}

/** Rough "how much is in here" so the fuller side of a log wins. */
function weigh(blob: unknown): number {
  if (!blob || typeof blob !== "object") return 0;
  let n = 0;
  for (const value of Object.values(blob as Record<string, unknown>)) {
    if (Array.isArray(value)) n += value.length;
    else if (value && typeof value === "object") n += Object.keys(value).length;
  }
  return n;
}

function applyExtras(local: Extras, remote: Extras): Extras {
  const out: Extras = {};
  for (const key of EXTRA_KEYS) {
    const mine = local[key];
    const theirs = remote[key];
    const winner = weigh(theirs) > weigh(mine) ? theirs : mine;
    if (winner === undefined) continue;
    out[key] = winner;
    if (winner === theirs) {
      try {
        globalThis.localStorage?.setItem(scoped(key), JSON.stringify(theirs));
      } catch {
        // Storage unavailable — the cloud copy still holds it.
      }
    }
  }
  return out;
}

// ── transport ──────────────────────────────────────────────────────────────────────────────────

interface RemoteBlob {
  progress?: Progress;
  extras?: Extras;
}

async function pull(userId: string): Promise<RemoteBlob | null> {
  const { data, error } = await supabase
    .from("integral_progress")
    .select("progress")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.progress ?? null) as RemoteBlob | null;
}

async function push(userId: string): Promise<boolean> {
  const payload: RemoteBlob = { progress: getProgress(), extras: readExtras() };
  const { error } = await supabase
    .from("integral_progress")
    .upsert(
      { user_id: userId, progress: payload as never, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return !error;
}

function schedulePush() {
  if (!currentUser) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const userId = currentUser;
    if (!userId) return;
    setStatus("syncing");
    void push(userId).then((ok) => setStatus(ok ? "synced" : "offline"));
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Point sync at an account (or at nobody, when signed out). Safe to call on every render — it does
 * nothing unless the account actually changed.
 */
export function startSync(userId: string | null) {
  if (userId === currentUser) return;
  currentUser = userId;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  unsubscribeLocal?.();
  unsubscribeLocal = null;

  if (!userId) {
    setStatus("idle");
    return;
  }

  setStatus("syncing");
  void (async () => {
    const remote = await pull(userId);
    if (currentUser !== userId) return;
    if (remote?.progress) {
      replaceProgress(mergeProgress(getProgress(), { ...emptyProgress(), ...remote.progress }));
    }
    applyExtras(readExtras(), remote?.extras ?? {});
    const ok = await push(userId);
    if (currentUser !== userId) return;
    setStatus(ok ? "synced" : "offline");
    unsubscribeLocal = subscribe(schedulePush);
  })();
}

/** Force a push now — used when leaving a run, so a close doesn't drop the last few seconds. */
export async function flushSync(): Promise<void> {
  if (!currentUser) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const ok = await push(currentUser);
  setStatus(ok ? "synced" : "offline");
}
