/**
 * UKUIB course progress — crowns, checkpoints, and where the student is on the path.
 *
 * Same shape as every store in this feature since attempts.ts: `scopedKey` from progress.ts so two
 * accounts on one browser never see each other's crowns, fail-soft when storage is unavailable, a
 * listener set for `useSyncExternalStore`, and a cache that re-checks the scoped key on every read
 * (so a scope change needs no notification from progress.ts — the next read simply notices).
 *
 * Hearts are deliberately NOT here. They are per-lesson and refill free on exit, so persisting them
 * would only create a way to be punished for closing a tab.
 *
 * XP is tracked here for the course's own readouts, and is *also* banked into the Arena's
 * `progress.ts` by the run hook, so a student has one streak and one level across both surfaces
 * rather than two competing notions of how far along they are.
 */
import { scopedKey } from "../progress";
import { dayKey } from "../daily";
import { MAX_CROWN, type UnitId } from "./curriculum";

const STORAGE_KEY = "arcana.integrals.ukuib.v1";

export interface SkillRecord {
  /** 0–MAX_CROWN. A crown is awarded per completed lesson at that level. */
  crown: number;
  /** Lessons finished in this skill, ever — including retries after running out of hearts. */
  lessonsDone: number;
  /** Best accuracy on a single lesson, 0–1. Shown on the skill node as a quality signal. */
  bestAccuracy: number;
  lastAt: string;
}

export interface CheckpointRecord {
  passed: boolean;
  /** Best score out of the checkpoint's question count. */
  best: number;
  at: string;
}

export interface UkuibProgress {
  version: 1;
  skills: Record<string, SkillRecord>;
  checkpoints: Partial<Record<UnitId, CheckpointRecord>>;
  xp: number;
  /** Calendar days on which at least one lesson was finished — the course's own activity trace. */
  lessonDays: Record<string, number>;
}

export function emptyUkuibProgress(): UkuibProgress {
  return { version: 1, skills: {}, checkpoints: {}, xp: 0, lessonDays: {} };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

let memory: UkuibProgress | null = null;
let memoryKey: string | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return scopedKey(STORAGE_KEY);
}

function read(): UkuibProgress {
  const key = storageKey();
  if (memory && memoryKey === key) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    memory = raw
      ? { ...emptyUkuibProgress(), ...(JSON.parse(raw) as UkuibProgress) }
      : emptyUkuibProgress();
  } catch {
    memory = emptyUkuibProgress();
  }
  memoryKey = key;
  return memory;
}

function write(next: UkuibProgress) {
  memory = next;
  memoryKey = storageKey();
  try {
    globalThis.localStorage?.setItem(memoryKey, JSON.stringify(next));
  } catch {
    // Storage unavailable — keep going in memory rather than losing the run.
  }
  for (const l of listeners) l();
}

export function subscribeUkuib(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getUkuibProgress(): UkuibProgress {
  return read();
}

export function resetUkuibProgress() {
  write(emptyUkuibProgress());
}

// ── reads ──────────────────────────────────────────────────────────────────────────────────────

export function crownOf(skillId: string, p: UkuibProgress = read()): number {
  return p.skills[skillId]?.crown ?? 0;
}

export function checkpointPassed(unitId: UnitId, p: UkuibProgress = read()): boolean {
  return p.checkpoints[unitId]?.passed ?? false;
}

/** Skills the student has actually been to — the pool interleaved review draws from. */
export function metSkillIds(p: UkuibProgress = read()): string[] {
  return Object.entries(p.skills)
    .filter(([, r]) => r.crown >= 1)
    .sort((a, b) => a[1].lastAt.localeCompare(b[1].lastAt))
    .map(([id]) => id);
}

/** The structural view the pure curriculum/lesson modules take, bound to the live store. */
export function crownState(p: UkuibProgress = read()) {
  return {
    crownOf: (skillId: string) => crownOf(skillId, p),
    checkpointPassed: (unitId: UnitId) => checkpointPassed(unitId, p),
  };
}

// ── writes ─────────────────────────────────────────────────────────────────────────────────────

export interface LessonOutcome {
  skillId: string;
  /** Exercises answered correctly / exercises that were scored. Reading isn't scored. */
  accuracy: number;
  xp: number;
  /** False when the student ran out of hearts — the lesson still counts as attempted, but no
   *  crown is awarded, exactly like Duolingo's own behaviour on a failed lesson. */
  completed: boolean;
}

/**
 * Record a finished lesson.
 *
 * A crown is awarded only on a completed run, and only up to MAX_CROWN — replaying a legendary
 * skill still banks XP and still counts as activity, it just has nothing left to award. That is
 * deliberate: a skill you have finished should stay practisable without the progression pretending
 * something new happened.
 */
export function recordLesson(outcome: LessonOutcome): UkuibProgress {
  const p = read();
  const prior = p.skills[outcome.skillId];
  const crown = prior?.crown ?? 0;
  const earned = outcome.completed && crown < MAX_CROWN ? 1 : 0;
  const today = dayKey(new Date());
  const next: UkuibProgress = {
    ...p,
    xp: p.xp + outcome.xp,
    skills: {
      ...p.skills,
      [outcome.skillId]: {
        crown: crown + earned,
        lessonsDone: (prior?.lessonsDone ?? 0) + 1,
        bestAccuracy: Math.max(prior?.bestAccuracy ?? 0, outcome.accuracy),
        lastAt: new Date().toISOString(),
      },
    },
    lessonDays: outcome.completed
      ? { ...p.lessonDays, [today]: (p.lessonDays[today] ?? 0) + 1 }
      : p.lessonDays,
  };
  write(next);
  return next;
}

export interface CheckpointOutcome {
  unitId: UnitId;
  score: number;
  total: number;
}

/** Pass mark is 70%, matching the checkpoint's stated 7-out-of-10. */
export const CHECKPOINT_PASS_RATIO = 0.7;

/**
 * Record a checkpoint attempt. Passing one opens the next unit outright — that is the "jump here"
 * affordance for someone already strong on the material, and the reason a confident competitor
 * isn't made to grind Foundations before they can see Gamma.
 *
 * A pass is sticky: failing a later re-attempt never re-locks what a student has already proved.
 */
export function recordCheckpoint(outcome: CheckpointOutcome): UkuibProgress {
  const p = read();
  const prior = p.checkpoints[outcome.unitId];
  const passed = outcome.total > 0 && outcome.score / outcome.total >= CHECKPOINT_PASS_RATIO;
  const next: UkuibProgress = {
    ...p,
    checkpoints: {
      ...p.checkpoints,
      [outcome.unitId]: {
        passed: (prior?.passed ?? false) || passed,
        best: Math.max(prior?.best ?? 0, outcome.score),
        at: new Date().toISOString(),
      },
    },
  };
  write(next);
  return next;
}
