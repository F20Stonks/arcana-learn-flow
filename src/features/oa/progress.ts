/**
 * What the arena remembers about you: your best sitting of each assessment, and how many you have
 * sat. Local only, same as the integrals progress store — there is no server in this feature and
 * nothing here leaves the browser.
 */
import { useSyncExternalStore } from "react";
import type { Assessment, RunResult } from "./types";

const STORAGE_KEY = "arcana.oa.progress.v1";

export interface AttemptRecord {
  /** Fraction of the maximum, 0–1. */
  best: number;
  bestCorrect: number;
  total: number;
  sittings: number;
  lastAt: string;
}

export interface OaProgress {
  version: 1;
  attempts: Record<string, AttemptRecord>;
}

export function emptyOaProgress(): OaProgress {
  return { version: 1, attempts: {} };
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
  });
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
