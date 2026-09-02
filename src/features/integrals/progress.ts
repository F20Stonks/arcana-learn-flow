/**
 * Player progress: XP, streak, solves, badges.
 *
 * Deliberately local-only for now. The competitive layer (shared leaderboards, friends, head-to-head
 * on the daily) needs a server and an identity; everything here is shaped so that layer can be
 * dropped in later — `recordDaily` returns the exact facts a submission endpoint would take, and
 * nothing in the UI reads localStorage directly.
 */
import { PROBLEMS, PROBLEM_BY_ID } from "./problems";
import { TECHNIQUES } from "./techniques";
import { configKey, type SprintConfig } from "./sprint";
import { dayKey } from "./daily";
import { levelState } from "./scoring";
import type { TechniqueId } from "./types";

const STORAGE_KEY = "arcana.integrals.progress.v1";

export interface SolveRecord {
  solvedAt: string;
  solves: number;
  bestSeconds: number;
  everSolvedWithoutHints: boolean;
}

export interface DailyRecord {
  problemId: string;
  solved: boolean;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  score: number;
}

/** One entry per sprint configuration — a 60-second warm-up best is not a 5-minute brutal best. */
export interface SprintBest {
  score: number;
  solved: number;
  runs: number;
  at: string;
}

export interface Progress {
  version: 1;
  xp: number;
  solves: Record<string, SolveRecord>;
  daily: Record<string, DailyRecord>;
  streak: { current: number; longest: number; lastDayKey: string | null };
  badges: Record<string, string>;
  lessonsRead: TechniqueId[];
  sprints: Record<string, SprintBest>;
  /**
   * Where you were last working, per practice queue — keyed by technique id (or "mixed"), valued
   * by problem id. Training used to restart at the top of the queue on every visit, so anyone
   * working through a long technique re-ground the same first problems every session.
   */
  bookmarks: Record<string, string>;
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    xp: 0,
    solves: {},
    daily: {},
    streak: { current: 0, longest: 0, lastDayKey: null },
    badges: {},
    lessonsRead: [],
    sprints: {},
    bookmarks: {},
  };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────

/** Survives private mode, disabled storage and SSR: the game still runs, it just forgets. */
let memory: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (memory) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    memory = raw ? { ...emptyProgress(), ...(JSON.parse(raw) as Progress) } : emptyProgress();
  } catch {
    memory = emptyProgress();
  }
  return memory;
}

function write(next: Progress) {
  memory = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is unavailable — keep going in memory rather than losing the session.
  }
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProgress(): Progress {
  return read();
}

/** Tests and the settings screen. */
export function resetProgress() {
  write(emptyProgress());
}

function update(fn: (p: Progress) => Progress) {
  write(fn(structuredClone(read())));
}

// ── streaks ────────────────────────────────────────────────────────────────────────────────────

function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return dayKey(prev);
}

/** Exported for the test suite — the calendar arithmetic is the part that goes wrong. */
export function nextStreak(
  streak: Progress["streak"],
  today: string,
): Progress["streak"] {
  if (streak.lastDayKey === today) return streak;
  const current = streak.lastDayKey === previousDayKey(today) ? streak.current + 1 : 1;
  return { current, longest: Math.max(streak.longest, current), lastDayKey: today };
}

/**
 * A streak that wasn't extended yesterday is already dead, but nothing writes to storage until the
 * player solves something — so the display has to work it out.
 */
export function liveStreak(p: Progress, today = dayKey()): number {
  const { current, lastDayKey } = p.streak;
  if (!lastDayKey) return 0;
  if (lastDayKey === today || lastDayKey === previousDayKey(today)) return current;
  return 0;
}

// ── recording ──────────────────────────────────────────────────────────────────────────────────

export interface SolveFacts {
  problemId: string;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  xp: number;
  score: number;
}

/** A training solve: XP and the personal best, no streak involvement. */
export function recordTrainingSolve(facts: SolveFacts) {
  update((p) => {
    applySolve(p, facts);
    p.xp += facts.xp;
    p.badges = { ...p.badges, ...earnedBadges(p) };
    return p;
  });
}

/** A daily attempt. Returns the facts a future leaderboard submission would carry. */
export function recordDaily(
  facts: SolveFacts & { solved: boolean },
  date = new Date(),
): DailyRecord & { dayKey: string; streak: number } {
  const key = dayKey(date);
  let out!: DailyRecord & { dayKey: string; streak: number };
  update((p) => {
    if (facts.solved) {
      applySolve(p, facts);
      p.xp += facts.xp;
      p.streak = nextStreak({ ...p.streak, current: liveStreak(p, key) }, key);
    }
    const record: DailyRecord = {
      problemId: facts.problemId,
      solved: facts.solved,
      seconds: facts.seconds,
      hintsUsed: facts.hintsUsed,
      wrongAttempts: facts.wrongAttempts,
      score: facts.solved ? facts.score : 0,
    };
    p.daily[key] = record;
    p.badges = { ...p.badges, ...earnedBadges(p) };
    out = { ...record, dayKey: key, streak: p.streak.current };
    return p;
  });
  return out;
}

function applySolve(p: Progress, facts: SolveFacts) {
  const prior = p.solves[facts.problemId];
  p.solves[facts.problemId] = {
    solvedAt: new Date().toISOString(),
    solves: (prior?.solves ?? 0) + 1,
    bestSeconds: Math.min(prior?.bestSeconds ?? Infinity, facts.seconds),
    everSolvedWithoutHints: (prior?.everSolvedWithoutHints ?? false) || facts.hintsUsed === 0,
  };
}

/**
 * A finished sprint. Individual solves were already banked as they happened, so this only records
 * the run itself — and reports whether it beat the standing best, which is the whole point.
 */
export function recordSprint(
  config: SprintConfig,
  run: { score: number; solved: number },
): { best: SprintBest; beatenBy: number | null } {
  const key = configKey(config);
  let out!: { best: SprintBest; beatenBy: number | null };
  update((p) => {
    const prior = p.sprints[key];
    const improved = !prior || run.score > prior.score;
    const best: SprintBest = {
      score: Math.max(prior?.score ?? 0, run.score),
      solved: Math.max(prior?.solved ?? 0, run.solved),
      runs: (prior?.runs ?? 0) + 1,
      at: improved || !prior ? new Date().toISOString() : prior.at,
    };
    p.sprints[key] = best;
    p.badges = { ...p.badges, ...earnedBadges(p) };
    out = { best, beatenBy: improved && prior ? run.score - prior.score : null };
    return p;
  });
  return out;
}

export function sprintBest(p: Progress, config: SprintConfig): SprintBest | undefined {
  return p.sprints[configKey(config)];
}

export function totalSprints(p: Progress): number {
  return Object.values(p.sprints).reduce((n, s) => n + s.runs, 0);
}

export function markLessonRead(id: TechniqueId) {
  update((p) => {
    if (!p.lessonsRead.includes(id)) p.lessonsRead.push(id);
    p.badges = { ...p.badges, ...earnedBadges(p) };
    return p;
  });
}

/** Remember where a practice queue got to. Keyed by technique id, or "mixed". */
export function markPlace(queueKey: string, problemId: string) {
  update((p) => {
    p.bookmarks = { ...p.bookmarks, [queueKey]: problemId };
    return p;
  });
}

export function lastPlace(p: Progress, queueKey: string): string | undefined {
  return p.bookmarks?.[queueKey];
}

export function hasSolved(p: Progress, problemId: string): boolean {
  return Boolean(p.solves[problemId]);
}

export function todaysDaily(p: Progress, date = new Date()): DailyRecord | undefined {
  return p.daily[dayKey(date)];
}

// ── derived stats ──────────────────────────────────────────────────────────────────────────────

export interface TechniqueMastery {
  id: TechniqueId;
  solved: number;
  total: number;
  lessonRead: boolean;
  /** 0–1 across both halves: reading the lesson is worth a fifth, solving the rest. */
  mastery: number;
}

export function techniqueMastery(p: Progress, id: TechniqueId): TechniqueMastery {
  const pool = PROBLEMS.filter((q) => q.techniques.includes(id));
  const solved = pool.filter((q) => hasSolved(p, q.id)).length;
  const lessonRead = p.lessonsRead.includes(id);
  const solveShare = pool.length ? solved / pool.length : 0;
  return { id, solved, total: pool.length, lessonRead, mastery: 0.2 * (lessonRead ? 1 : 0) + 0.8 * solveShare };
}

export function allMastery(p: Progress): TechniqueMastery[] {
  return TECHNIQUES.map((t) => techniqueMastery(p, t.id));
}

export interface Stats {
  solvedCount: number;
  totalProblems: number;
  dailiesSolved: number;
  streak: number;
  longestStreak: number;
  level: ReturnType<typeof levelState>;
  badges: Badge[];
}

export function stats(p: Progress, date = new Date()): Stats {
  return {
    solvedCount: Object.keys(p.solves).length,
    totalProblems: PROBLEMS.length,
    dailiesSolved: Object.values(p.daily).filter((d) => d.solved).length,
    streak: liveStreak(p, dayKey(date)),
    longestStreak: p.streak.longest,
    level: levelState(p.xp),
    badges: BADGES.filter((b) => p.badges[b.id]),
  };
}

// ── badges ─────────────────────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: (p: Progress) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: "first-blood",
    name: "First Blood",
    description: "Solve your first integral.",
    icon: "✳",
    earned: (p) => Object.keys(p.solves).length >= 1,
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Solve anything in under 20 seconds.",
    icon: "⚡",
    earned: (p) => Object.values(p.solves).some((s) => s.bestSeconds < 20),
  },
  {
    id: "unaided",
    name: "Unaided",
    description: "Beat a Brutal problem without opening a single hint.",
    icon: "🗝",
    earned: (p) =>
      Object.entries(p.solves).some(
        ([id, s]) => s.everSolvedWithoutHints && PROBLEM_BY_ID[id]?.difficulty === 5,
      ),
  },
  {
    id: "week-streak",
    name: "Seven Straight",
    description: "Solve the daily seven days in a row.",
    icon: "🔥",
    earned: (p) => p.streak.longest >= 7,
  },
  {
    id: "month-streak",
    name: "Thirty Straight",
    description: "Solve the daily thirty days in a row.",
    icon: "☄",
    earned: (p) => p.streak.longest >= 30,
  },
  {
    id: "flawless",
    name: "Flawless",
    description: "Five dailies solved with no hints and no wrong answers.",
    icon: "◈",
    earned: (p) =>
      Object.values(p.daily).filter((d) => d.solved && d.hintsUsed === 0 && d.wrongAttempts === 0)
        .length >= 5,
  },
  {
    id: "sprinter",
    name: "Sprinter",
    description: "Finish ten sprints.",
    icon: "⏱",
    earned: (p) => totalSprints(p) >= 10,
  },
  {
    id: "blitz",
    name: "Blitz",
    description: "Score 150 or more in a one-minute sprint.",
    icon: "⚡",
    earned: (p) =>
      Object.entries(p.sprints).some(([key, s]) => key.endsWith("-60") && s.score >= 150),
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Read every technique lesson.",
    icon: "📖",
    earned: (p) => TECHNIQUES.every((t) => p.lessonsRead.includes(t.id)),
  },
  {
    id: "half-the-bank",
    name: "Half the Bank",
    description: "Solve half of every problem in the game.",
    icon: "◐",
    earned: (p) => Object.keys(p.solves).length >= Math.ceil(PROBLEMS.length / 2),
  },
  ...TECHNIQUES.map((t) => ({
    id: `master-${t.id}`,
    name: `${t.name} Mastery`,
    description: `Solve every ${t.name.toLowerCase()} problem in the bank.`,
    icon: "◆",
    earned: (p: Progress) => {
      const m = techniqueMastery(p, t.id);
      return m.total > 0 && m.solved === m.total;
    },
  })),
];

/** Badges newly true for this state, stamped with when they were earned. */
function earnedBadges(p: Progress): Record<string, string> {
  const now = new Date().toISOString();
  const out: Record<string, string> = {};
  for (const b of BADGES) if (!p.badges[b.id] && b.earned(p)) out[b.id] = now;
  return out;
}

export const BADGE_BY_ID: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.id, b]));
