import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DrillAttemptLog, DrillMode, WeakSpot } from "../types";

interface FinishRunArgs {
  userId: string;
  drillKey: string;
  mode: DrillMode;
  config: Record<string, unknown>;
  attempts: DrillAttemptLog[];
  durationS: number;
}

/**
 * Scores and XP are recomputed server-side from the raw attempt list (see the `record_drill_run`
 * database routine) — the client can no longer write drill rows or its own XP directly, so a
 * forged request can't put a fabricated score on the leaderboard. The local numbers below are
 * only an optimistic fallback for the summary screen when the write fails.
 */
export async function finishDrillRun({ userId, drillKey, mode, config, attempts, durationS }: FinishRunArgs) {
  void userId;
  const localCorrect = attempts.filter((a) => a.correct).length;
  const localIncorrect = attempts.length - localCorrect;
  const perMinute = durationS > 0 ? localCorrect / (durationS / 60) : localCorrect;

  const { data, error } = await supabase.rpc("record_drill_run", {
    p_drill_key: drillKey,
    p_mode: mode,
    p_config: config as Json,
    p_attempts: attempts.map((a) => ({
      tag: a.tag,
      correct: a.correct,
      latencyMs: Math.round(a.latencyMs),
    })) as unknown as Json,
    p_duration_s: Math.round(durationS),
  });

  if (error || !data) {
    console.warn("Drill run write failed:", error?.message);
    return {
      correctCount: localCorrect,
      incorrectCount: localIncorrect,
      score: Math.round(perMinute * 10) / 10,
      xpEarned: 0,
      perMinute,
    };
  }

  const result = data as unknown as {
    correctCount: number;
    incorrectCount: number;
    score: number;
    xpEarned: number;
  };
  return { ...result, perMinute };
}

export async function fetchWeakSpots(userId: string, drillKey: string, limit = 5): Promise<WeakSpot[]> {
  const { data, error } = await supabase
    .from("drill_weak_spots")
    .select("problem_tag, accuracy, attempts")
    .eq("user_id", userId)
    .eq("drill_key", drillKey)
    .gte("attempts", 3)
    .order("accuracy", { ascending: true })
    .limit(limit);
  if (error) {
    console.warn("Weak-spot fetch failed:", error.message);
    return [];
  }
  return (data || []) as WeakSpot[];
}

export interface DrillBest {
  drill_key: string;
  mode: string;
  score: number;
  created_at: string;
}

export async function fetchPersonalBests(userId: string): Promise<Record<string, DrillBest>> {
  const { data, error } = await supabase
    .from("drill_sessions")
    .select("drill_key, mode, score, created_at")
    .eq("user_id", userId)
    .order("score", { ascending: false });
  if (error || !data) return {};
  const best: Record<string, DrillBest> = {};
  for (const row of data as DrillBest[]) {
    const key = `${row.drill_key}:${row.mode}`;
    if (!best[key]) best[key] = row;
  }
  return best;
}

export async function fetchRecentSessions(userId: string, limit = 8) {
  const { data } = await supabase
    .from("drill_sessions")
    .select("id, drill_key, mode, score, problems_correct, problems_seen, duration_s, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
