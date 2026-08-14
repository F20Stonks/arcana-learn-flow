/**
 * Writes one row per scene request to `scene_outcomes` (see the migration for why this table exists).
 *
 * Strictly fire-and-forget: a logging failure must never delay, degrade, or block the scene the
 * student is waiting for. Every path here swallows its own errors — the ONE place in this codebase
 * where swallowing is the right call, because the thing being protected is the student's render and
 * the thing being lost is a single row of telemetry.
 */
import { supabase } from "@/integrations/supabase/client";

export type SceneOutcome = "clean" | "repaired" | "model-repaired" | "degraded" | "failed" | "no-scene";

export interface SceneOutcomeRecord {
  request: string;
  outcome: SceneOutcome;
  /** which rung of the ladder in sceneDirector.ts this exited on */
  rung: number;
  sessionId?: string | null;
  subtopicId?: string | null;
  hardFail?: boolean;
  flags?: string[];
  issueKinds?: string[];
  repairActions?: string[];
  primCount?: number | null;
  attempts?: number;
}

/** Postgres text[] columns reject overlong junk far less gracefully than a trimmed array. */
const cap = (xs: string[] | undefined, n = 12) => (xs ?? []).slice(0, n).map((s) => s.slice(0, 300));

export async function logSceneOutcome(rec: SceneOutcomeRecord): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    // Anonymous/dev contexts (the /dev/ui harness, a logged-out preview) have no user to attribute
    // the row to, and RLS would reject the insert anyway. Skip silently rather than log noise.
    if (!userId) return;

    // `scene_outcomes` post-dates the generated types file, so it is cast like the other
    // not-yet-typed tables in this codebase rather than regenerating types by hand.
    await (supabase.from("scene_outcomes" as never) as any).insert({
      user_id: userId,
      session_id: rec.sessionId ?? null,
      subtopic_id: rec.subtopicId ?? null,
      request: rec.request.slice(0, 4000),
      outcome: rec.outcome,
      rung: rec.rung,
      source: "freehand",
      hard_fail: rec.hardFail ?? false,
      flags: cap(rec.flags),
      issue_kinds: cap(rec.issueKinds),
      repair_actions: cap(rec.repairActions),
      prim_count: rec.primCount ?? null,
      attempts: rec.attempts ?? null,
    });
  } catch {
    /* telemetry must never cost the student a scene */
  }
}
