/**
 * What the arena remembers about you: your best sitting of each assessment, and how many you have
 * sat. Local only, same as the integrals progress store — there is no server in this feature and
 * nothing here leaves the browser.
 */
import { useSyncExternalStore } from "react";
import type { Assessment, Attempt, QuestionKind, RunResult } from "./types";

const STORAGE_KEY = "arcana.oa.progress.v1";

export interface AttemptRecord {
  /** Fraction of the maximum, 0–1. */
  best: number;
  bestCorrect: number;
  total: number;
  sittings: number;
  lastAt: string;
}

/** A running tally per question kind, across every paper and drill ever sat. */
export interface KindRecord {
  seen: number;
  correct: number;
  /** Total milliseconds spent, so the arena can say what is slow as well as what is wrong. */
  ms: number;
}

export interface OaProgress {
  version: 1;
  attempts: Record<string, AttemptRecord>;
  /**
   * Per question kind rather than per assessment: "you are losing marks on sequences" is the
   * finding a candidate can act on, and it is invisible from a per-paper score because every
   * paper mixes kinds.
   */
  kinds: Partial<Record<QuestionKind, KindRecord>>;
}

export function emptyOaProgress(): OaProgress {
  return { version: 1, attempts: {}, kinds: {} };
}

export function assessmentKey(assessment: Assessment): string {
  return `${assessment.firmId}/${assessment.id}`;
}

let memory: OaProgress | null = null;
const listeners = new Set<() => void>();

function read(): OaProgress {
  if (memory) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    memory = raw ? { ...emptyOaProgress(), ...(JSON.parse(raw) as OaProgress) } : emptyOaProgress();
  } catch {
    memory = emptyOaProgress();
  }
  return memory;
}

function write(next: OaProgress) {
  memory = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — keep the session in memory rather than losing it.
  }
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOaProgress(): OaProgress {
  return read();
}

export function resetOaProgress() {
  write(emptyOaProgress());
}

/** Fold a batch of attempts into the per-kind tallies. Shared by papers and drills. */
function tally(kinds: OaProgress["kinds"], attempts: readonly Attempt[]): OaProgress["kinds"] {
  const next = { ...kinds };
  for (const a of attempts) {
    const kind = a.question.kind;
    const existing = next[kind] ?? { seen: 0, correct: 0, ms: 0 };
    next[kind] = {
      seen: existing.seen + 1,
      correct: existing.correct + (a.correct ? 1 : 0),
      ms: existing.ms + a.ms,
    };
  }
  return next;
}

export function recordSitting(result: RunResult) {
  const key = assessmentKey(result.assessment);
  const current = read();
  const existing = current.attempts[key];
  write({
    ...current,
    attempts: {
      ...current.attempts,
      [key]: {
        best: Math.max(existing?.best ?? 0, result.score),
        bestCorrect: Math.max(existing?.bestCorrect ?? 0, result.correct),
        total: result.total,
        sittings: (existing?.sittings ?? 0) + 1,
        lastAt: new Date().toISOString(),
      },
    },
    kinds: tally(current.kinds, result.sections.flatMap((s) => s.attempts)),
  });
}

/** A drill has no assessment behind it, so it only moves the per-kind tallies. */
export function recordDrill(attempts: readonly Attempt[]) {
  const current = read();
  write({ ...current, kinds: tally(current.kinds, attempts) });
}

export interface KindStanding {
  kind: QuestionKind;
  seen: number;
  correct: number;
  accuracy: number;
  /** Mean seconds per question. */
  pace: number;
}

/** Where you stand on each kind you have actually seen, worst accuracy first. */
export function kindStandings(progress: OaProgress): KindStanding[] {
  return Object.entries(progress.kinds ?? {})
    .filter(([, r]) => r && r.seen > 0)
    .map(([kind, r]) => ({
      kind: kind as QuestionKind,
      seen: r!.seen,
      correct: r!.correct,
      accuracy: r!.correct / r!.seen,
      pace: r!.ms / r!.seen / 1000,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen);
}

/**
 * What to drill next. Needs a real sample behind it — telling someone their weakest kind on the
 * strength of three questions is noise dressed as advice.
 */
export function weakestKind(progress: OaProgress, minimumSeen = 10): KindStanding | undefined {
  return kindStandings(progress).find((s) => s.seen >= minimumSeen && s.accuracy < 0.9);
}

export function bestFor(progress: OaProgress, assessment: Assessment): AttemptRecord | undefined {
  return progress.attempts[assessmentKey(assessment)];
}

/** How many distinct assessments have been sat at least once. */
export function sittingsCount(progress: OaProgress): { assessments: number; total: number } {
  const records = Object.values(progress.attempts);
  return {
    assessments: records.length,
    total: records.reduce((n, r) => n + r.sittings, 0),
  };
}

export function useOaProgress(): OaProgress {
  return useSyncExternalStore(subscribe, getOaProgress, getOaProgress);
}
