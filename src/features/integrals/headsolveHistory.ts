/**
 * Headsolve persistence — the graded-attempt log and the difficulty ladder's position.
 *
 * headsolve.ts is pure (a problem and a grade in, a ranking or a ladder transition out) and has no
 * memory of its own; this is that memory. Same localStorage + per-account scoping pattern as
 * attempts.ts/recognitionHistory.ts/campaignStore.ts: scopedKey, fail-soft when storage is
 * unavailable, a listener set for useSyncExternalStore, and a cache that self-invalidates by
 * re-checking the scoped key on every read — so, as with those, this needs no notification wiring
 * from progress.ts's setProgressScope.
 *
 * Every graded attempt is recorded here AND mirrored (coarsely) into the shared WS-1 attempt log
 * under mode "headsolve" — see recordHeadsolveAttempt's doc comment for exactly how, and why the
 * mirror can never pollute a typed-mode timing statistic even though it shares the log.
 */
import { recordAttempt } from "./attempts";
import { scopedKey } from "./progress";
import {
  applyGrade,
  beatsTarget,
  initialLadderState,
  type HeadsolveAttempt,
  type HeadsolveBandId,
  type HeadsolveGrade,
  type HeadsolveLadderState,
} from "./headsolve";
import type { TechniqueId } from "./types";

const STORAGE_KEY = "arcana.integrals.headsolve.v1";

/** Ring-buffer cap — a headsolve round moves fast (each question is graded in seconds to tens of
 *  seconds, no typing to slow it down), so this is sized like recognitionHistory's cap: comfortably
 *  enough for months of regular drilling, not so large an account running for years could fill
 *  localStorage with it. */
export const MAX_HEADSOLVE_ATTEMPTS = 4000;

interface HeadsolveLog {
  version: 1;
  attempts: HeadsolveAttempt[];
  ladder: HeadsolveLadderState;
}

function emptyLog(): HeadsolveLog {
  return { version: 1, attempts: [], ladder: initialLadderState() };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

let memory: HeadsolveLog | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): HeadsolveLog {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw ? { ...emptyLog(), ...(JSON.parse(raw) as HeadsolveLog) } : emptyLog();
  } catch {
    memory = emptyLog();
  }
  memoryKey = key;
  return memory;
}

function write(next: HeadsolveLog) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the session's evidence.
  }
  for (const l of listeners) l();
}

export function subscribeHeadsolveHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getHeadsolveAttempts(): HeadsolveAttempt[] {
  return read().attempts;
}

export function getLadderState(): HeadsolveLadderState {
  return read().ladder;
}

/** Tests, and a possible future settings screen, alongside resetAttempts/resetProgress. */
export function resetHeadsolveHistory() {
  write(emptyLog());
}

// ── recording ──────────────────────────────────────────────────────────────────────────────────

export interface RecordHeadsolveAttemptInput {
  problemId: string;
  /** The problem's primary technique. */
  technique: TechniqueId;
  band: HeadsolveBandId;
  grade: HeadsolveGrade;
  /** Problem shown → clock stopped, ms. */
  thinkMs: number;
  /** Defaults to now; only ever overridden by tests. */
  at?: Date;
}

let ordinal = 0;

/**
 * Records one graded headsolve attempt: appends it to this module's own ring-buffered log (with
 * the full grade, band and think time headsolve mode actually needs), advances the ladder via
 * applyGrade and persists the result, and mirrors a coarse copy into the shared WS-1 attempt log
 * (attempts.ts) under mode "headsolve".
 *
 * The mirror deliberately cannot pollute a typed-mode timing statistic: it has no keystroke event
 * to report, so both msToFirstKeystroke and msFirstKeystrokeToSubmit are recorded as null — the
 * honest value, not a workaround — and every consumer of those fields already filters nulls before
 * averaging (see uk/campaignReadiness.ts). thinkMs itself, the number headsolve mode exists to
 * measure, lives only in this module's own log, never in the shared one. The mirror's verdictClass
 * also deliberately never uses "off-by-constant-factor" for a self-graded "close" — that class is
 * reserved elsewhere (queue.ts's scheduler) for a machine-verified numeric near-miss, and a self-
 * report is a different kind of evidence that shouldn't quietly pull that same lever; "close" maps
 * to the honest coarse bucket "incorrect" instead, same as "no".
 */
export function recordHeadsolveAttempt(input: RecordHeadsolveAttemptInput): {
  attempt: HeadsolveAttempt;
  ladder: HeadsolveLadderState;
} {
  const at = input.at ?? new Date();
  ordinal = (ordinal + 1) % 1_000_000;
  const attempt: HeadsolveAttempt = {
    id: `${input.problemId}:${at.getTime()}:${ordinal}`,
    problemId: input.problemId,
    technique: input.technique,
    band: input.band,
    grade: input.grade,
    thinkMs: input.thinkMs,
    beatTarget: beatsTarget(input.band, input.thinkMs),
    at: at.toISOString(),
  };

  const log = read();
  const attempts = [...log.attempts, attempt];
  const trimmed =
    attempts.length > MAX_HEADSOLVE_ATTEMPTS
      ? attempts.slice(attempts.length - MAX_HEADSOLVE_ATTEMPTS)
      : attempts;
  const ladder = applyGrade(log.ladder, input.grade);
  write({ ...log, attempts: trimmed, ladder });

  recordAttempt({
    problemId: input.problemId,
    mode: "headsolve",
    verdictClass: input.grade === "got-it" ? "correct" : "incorrect",
    submitted: `[headsolve: ${input.grade}]`,
    hintsOpen: 0,
    wrongAttemptsSoFar: 0,
    msToFirstKeystroke: null,
    msFirstKeystrokeToSubmit: null,
    at,
  });

  return { attempt, ladder };
}
