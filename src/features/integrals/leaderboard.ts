/**
 * The daily leaderboard.
 *
 * Everything here fails soft. The migration that creates these tables ships alongside this code but
 * is not applied until someone runs it, and the game has to keep working in the meantime — a daily
 * you can play is worth more than a board you can read. Every call returns null or an empty result
 * rather than throwing, and the UI treats that as "no board yet".
 *
 * Trust model, stated plainly: the client reports its own time and result. The table enforces one
 * submission per puzzle and rejects puzzles outside a one-day window of the server's own clock, so
 * a streak cannot be backfilled and a day cannot be replayed for a better score. It does not stop a
 * determined player forging a single day's number. Closing that needs an edge function that picks
 * the problem, grades the answer and times the run server-side; `submitDaily` is the only place
 * that would change.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The generated Supabase types are produced from the deployed schema, which does not yet contain
 * these relations. One cast here beats scattering `as never` through every query.
 */
const db = supabase as unknown as SupabaseClient;

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  rank: number;
}

export interface Turnout {
  players: number;
  solvers: number;
  averageScore: number;
  topScore: number;
}

export interface DailySubmission {
  puzzleNumber: number;
  problemId: string;
  solved: boolean;
  seconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  score: number;
}

export type SubmitOutcome = "submitted" | "already-played" | "unavailable";

/**
 * Records a finished daily. "already-played" is the unique constraint firing, which is a correct
 * outcome rather than an error — it means this puzzle was submitted from another device.
 */
export async function submitDaily(userId: string, run: DailySubmission): Promise<SubmitOutcome> {
  try {
    const { error } = await db.from("integral_daily_results").insert({
      user_id: userId,
      puzzle_number: run.puzzleNumber,
      problem_id: run.problemId,
      solved: run.solved,
      seconds: run.seconds,
      hints_used: run.hintsUsed,
      wrong_attempts: run.wrongAttempts,
      score: run.score,
    });
    if (!error) return "submitted";
    // 23505 is unique_violation: this puzzle already has a row for this user.
    if ((error as { code?: string }).code === "23505") return "already-played";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function fetchBoard(puzzleNumber: number, limit = 100): Promise<LeaderboardRow[] | null> {
  try {
    const { data, error } = await db
      .from("integral_daily_leaderboard")
      .select("user_id, display_name, avatar_url, score, seconds, hints_used, wrong_attempts, rank")
      .eq("puzzle_number", puzzleNumber)
      .order("rank", { ascending: true })
      .limit(limit);
    if (error || !data) return null;
    return (data as Array<Record<string, unknown>>).map((row) => ({
      userId: String(row.user_id),
      displayName: String(row.display_name ?? "Anonymous"),
      avatarUrl: (row.avatar_url as string | null) ?? null,
      score: Number(row.score),
      seconds: Number(row.seconds),
      hintsUsed: Number(row.hints_used),
      wrongAttempts: Number(row.wrong_attempts),
      rank: Number(row.rank),
    }));
  } catch {
    return null;
  }
}

export async function fetchTurnout(puzzleNumber: number): Promise<Turnout | null> {
  try {
    const { data, error } = await db
      .from("integral_daily_turnout")
      .select("players, solvers, average_score, top_score")
      .eq("puzzle_number", puzzleNumber)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      players: Number(row.players ?? 0),
      solvers: Number(row.solvers ?? 0),
      averageScore: Number(row.average_score ?? 0),
      topScore: Number(row.top_score ?? 0),
    };
  } catch {
    return null;
  }
}

// ── pure helpers ───────────────────────────────────────────────────────────────────────────────

/** "1st", "2nd", "23rd" — English ordinals, including the teens that break the pattern. */
export function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * The share of solvers this run beat, as a whole percent.
 *
 * Ties count as beaten by neither side: coming joint-first with everyone means you beat nobody,
 * which is the honest reading and stops a one-player board reporting 100%.
 */
export function percentileAmong(score: number, rows: readonly LeaderboardRow[]): number {
  if (rows.length <= 1) return 0;
  const below = rows.filter((r) => r.score < score).length;
  return Math.round((below / (rows.length - 1)) * 100);
}

export interface BoardWindow {
  top: LeaderboardRow[];
  /** The rows around you, when you are too far down to appear in `top`. */
  around: LeaderboardRow[];
  you: LeaderboardRow | null;
}

/**
 * What to actually render.
 *
 * A hundred rows is not a leaderboard, it is a phone book. Show the podium and the handful of
 * people either side of you — the two numbers a player wants are who won and who they can catch.
 */
export function boardWindow(
  rows: readonly LeaderboardRow[],
  userId: string | null,
  topCount = 3,
  radius = 2,
): BoardWindow {
  const top = rows.slice(0, topCount);
  const index = userId ? rows.findIndex((r) => r.userId === userId) : -1;
  const you = index >= 0 ? rows[index] : null;

  if (index < 0 || index < topCount) return { top, around: [], you };

  const from = Math.max(topCount, index - radius);
  const around = rows.slice(from, index + radius + 1);
  return { top, around, you };
}

// ── submission bookkeeping ─────────────────────────────────────────────────────────────────────

const SUBMITTED_KEY = "arcana.integrals.submitted.v1";

/**
 * Which puzzles this browser has already sent. The unique constraint is the real guarantee; this
 * only saves a pointless round trip on every reload of a day already recorded.
 */
export function submittedPuzzles(): number[] {
  try {
    const raw = globalThis.localStorage?.getItem(SUBMITTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function rememberSubmitted(puzzleNumber: number) {
  try {
    const next = [...new Set([...submittedPuzzles(), puzzleNumber])].slice(-90);
    globalThis.localStorage?.setItem(SUBMITTED_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — the unique constraint still stops a duplicate landing.
  }
}
