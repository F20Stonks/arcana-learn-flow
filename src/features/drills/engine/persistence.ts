import { supabase } from "@/integrations/supabase/client";
import type { DrillAttemptLog, DrillMode, WeakSpot } from "../types";

interface FinishRunArgs {
  userId: string;
  drillKey: string;
  mode: DrillMode;
  config: Record<string, unknown>;
  attempts: DrillAttemptLog[];
  durationS: number;
}

/** XP is the only live gamification hook — weekly_streak is displayed in the shell but nothing in
 *  the app increments it yet (checked: assess-session never touches it), so drills don't invent a
 *  streak semantic that doesn't exist anywhere else. */
function xpFor(correctCount: number, incorrectCount: number): number {
  return Math.max(0, correctCount * 2 - Math.min(incorrectCount, correctCount));
}

export async function finishDrillRun({ userId, drillKey, mode, config, attempts, durationS }: FinishRunArgs) {
  const correctCount = attempts.filter((a) => a.correct).length;
  const incorrectCount = attempts.length - correctCount;
  const perMinute = durationS > 0 ? correctCount / (durationS / 60) : correctCount;
  const score = Math.round(perMinute * 10) / 10;
  const xpEarned = xpFor(correctCount, incorrectCount);

  const { data: session, error: sessionError } = await supabase
    .from("drill_sessions")
    .insert({
      user_id: userId,
      drill_key: drillKey,
      mode,
      config,
      problems_seen: attempts.length,
      problems_correct: correctCount,
      score,
      duration_s: durationS,
      xp_earned: xpEarned,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.warn("Drill session write failed:", sessionError?.message);
    return { correctCount, incorrectCount, score, xpEarned, perMinute };
  }

  if (attempts.length > 0) {
    const rows = attempts.map((a) => ({
      session_id: session.id,
      user_id: userId,
      drill_key: drillKey,
      problem_tag: a.tag,
      correct: a.correct,
      latency_ms: Math.round(a.latencyMs),
    }));
    const { error: attemptsError } = await supabase.from("drill_attempts").insert(rows);
    if (attemptsError) console.warn("Drill attempts write failed:", attemptsError.message);
  }

  if (xpEarned > 0) {
    const { data: profile } = await supabase.from("profiles").select("total_xp").eq("user_id", userId).maybeSingle();
    if (profile) {
      await supabase.from("profiles").update({ total_xp: (profile.total_xp || 0) + xpEarned }).eq("user_id", userId);
    }
  }

  return { correctCount, incorrectCount, score, xpEarned, perMinute };
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
