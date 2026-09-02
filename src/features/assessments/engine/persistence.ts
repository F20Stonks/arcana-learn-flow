/**
 * Supabase writes for a finished run.
 *
 * Mirrors src/features/drills/engine/persistence.ts: fire-and-warn, never throwing into the UI —
 * a candidate who has just sat an eight-minute test must see their debrief whether or not the
 * write landed.
 *
 * Deliberately its own tables rather than drill_sessions/drill_attempts. A battery has several
 * sections with different scoring rules, and the debrief needs the item and the given answer,
 * which drill_attempts does not store (it holds only problem_tag, correct and latency_ms).
 */
import { supabase } from "@/integrations/supabase/client";
import type { RunResult } from "../types";

export interface PersistedRun {
  runId: string | null;
}

export async function saveRun(userId: string, result: RunResult, abandoned: boolean): Promise<PersistedRun> {
  const { data: run, error: runError } = await supabase
    .from("oa_runs")
    .insert({
      user_id: userId,
      firm_id: result.firmId,
      spec_version: result.specVersion,
      started_at: new Date(result.startedAt).toISOString(),
      finished_at: new Date(result.finishedAt).toISOString(),
      abandoned,
      tab_blur_count: result.tabBlurCount,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.warn("OA run write failed:", runError?.message);
    return { runId: null };
  }

  for (const section of result.sections) {
    const { data: sectionRow, error: sectionError } = await supabase
      .from("oa_section_results")
      .insert({
        run_id: run.id,
        user_id: userId,
        module_id: section.moduleId,
        raw_score: section.rawScore,
        items_seen: section.seen,
        items_correct: section.correct,
        items_wrong: section.wrong,
        items_skipped: section.skipped,
        duration_s: section.durationS,
        pass_mark: section.passMark,
      })
      .select("id")
      .single();

    if (sectionError || !sectionRow) {
      console.warn("OA section write failed:", sectionError?.message);
      continue;
    }

    // Only answered items are stored. An 80-question test where the candidate reached 40 should
    // write 40 rows, not 80 rows of empty strings.
    const rows = section.items
      .filter((i) => !i.skipped)
      .map((i) => ({
        section_id: sectionRow.id,
        user_id: userId,
        firm_id: result.firmId,
        module_id: section.moduleId,
        problem_tag: i.tag,
        prompt: i.prompt,
        given: i.given,
        expected: i.expected,
        correct: i.correct,
        latency_ms: Math.round(i.latencyMs),
      }));

    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from("oa_items").insert(rows);
      if (itemsError) console.warn("OA item write failed:", itemsError.message);
    }
  }

  return { runId: run.id };
}

export interface OaBest {
  firm_id: string;
  module_id: string;
  raw_score: number;
  created_at: string;
}

/** Best raw score per firm+module, for the catalog cards. */
export async function fetchBests(userId: string): Promise<Record<string, OaBest>> {
  const { data, error } = await supabase
    .from("oa_section_results")
    .select("module_id, raw_score, created_at, oa_runs!inner(firm_id)")
    .eq("user_id", userId)
    .order("raw_score", { ascending: false });

  if (error || !data) return {};

  const best: Record<string, OaBest> = {};
  for (const row of data as unknown as Array<{ module_id: string; raw_score: number; created_at: string; oa_runs: { firm_id: string } }>) {
    const firmId = row.oa_runs?.firm_id;
    if (!firmId) continue;
    const key = `${firmId}:${row.module_id}`;
    if (!best[key]) {
      best[key] = { firm_id: firmId, module_id: row.module_id, raw_score: row.raw_score, created_at: row.created_at };
    }
  }
  return best;
}
