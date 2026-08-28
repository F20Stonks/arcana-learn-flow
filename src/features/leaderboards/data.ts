/**
 * Competitive boards for the two live games: Integral Arena and Drills.
 *
 * Everything reads from owner-rights views (see the leaderboard migrations) that expose only a
 * player's chosen display name, avatar and their own game numbers — never the underlying rows,
 * which stay owner-scoped by RLS. Every call fails soft: an empty board beats a broken page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The generated types are produced from a schema snapshot that predates these views.
const db = supabase as unknown as SupabaseClient;

export interface ArenaRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalScore: number;
  daysPlayed: number;
  daysSolved: number;
  bestScore: number;
  avgSeconds: number | null;
  rank: number;
}

export interface DrillOverallRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  runs: number;
  gamesPlayed: number;
  accuracy: number;
  problemsCorrect: number;
  rank: number;
}

export interface DrillGameRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  drillKey: string;
  mode: string;
  bestScore: number;
  runs: number;
  accuracy: number;
  rank: number;
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));

export async function fetchArenaBoard(limit = 50): Promise<ArenaRow[]> {
  try {
    const { data, error } = await db
      .from("integral_arena_leaderboard")
      .select("user_id, display_name, avatar_url, total_score, days_played, days_solved, best_score, avg_seconds, rank")
      .order("rank", { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      userId: str(r.user_id),
      displayName: str(r.display_name, "Anonymous"),
      avatarUrl: (r.avatar_url as string | null) ?? null,
      totalScore: num(r.total_score),
      daysPlayed: num(r.days_played),
      daysSolved: num(r.days_solved),
      bestScore: num(r.best_score),
      avgSeconds: r.avg_seconds == null ? null : num(r.avg_seconds),
      rank: num(r.rank),
    }));
  } catch {
    return [];
  }
}

export async function fetchDrillOverallBoard(limit = 50): Promise<DrillOverallRow[]> {
  try {
    const { data, error } = await db
      .from("drill_leaderboard_overall")
      .select("user_id, display_name, avatar_url, xp, runs, games_played, accuracy, problems_correct, rank")
      .order("rank", { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      userId: str(r.user_id),
      displayName: str(r.display_name, "Anonymous"),
      avatarUrl: (r.avatar_url as string | null) ?? null,
      xp: num(r.xp),
      runs: num(r.runs),
      gamesPlayed: num(r.games_played),
      accuracy: num(r.accuracy),
      problemsCorrect: num(r.problems_correct),
      rank: num(r.rank),
    }));
  } catch {
    return [];
  }
}

/** Top runs for one game. `mode` is left open so a game with several modes shows each board. */
export async function fetchDrillGameBoard(drillKey: string, limit = 25): Promise<DrillGameRow[]> {
  try {
    const { data, error } = await db
      .from("drill_leaderboard")
      .select("user_id, display_name, avatar_url, drill_key, mode, best_score, runs, accuracy, rank")
      .eq("drill_key", drillKey)
      .order("best_score", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      userId: str(r.user_id),
      displayName: str(r.display_name, "Anonymous"),
      avatarUrl: (r.avatar_url as string | null) ?? null,
      drillKey: str(r.drill_key),
      mode: str(r.mode),
      bestScore: num(r.best_score),
      runs: num(r.runs),
      accuracy: num(r.accuracy),
      rank: num(r.rank),
    }));
  } catch {
    return [];
  }
}
