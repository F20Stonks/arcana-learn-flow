import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveTopicSpecChecklist } from "../_shared/specChecklistResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Resolves the specification checklist for an entire track by fanning out ONE resolution per topic in
// parallel (see specChecklistResolver.ts for why: a single flat excerpt can't cover a whole syllabus).
// Triggered on demand from the frontend (same pattern as resolve-past-papers), not blocking track
// creation. Service-role writes only — students never create these rows directly.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trackId } = await req.json();
    if (!trackId) {
      return new Response(JSON.stringify({ error: "trackId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Required env not configured");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Already resolved for this track? Return the cache — don't re-search/re-spend on every visit.
    const { data: existing } = await supabase.from("spec_checklist_items").select("*").eq("track_id", trackId);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ items: existing, fromCache: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: track } = await supabase.from("learning_tracks").select("*").eq("id", trackId).single();
    if (!track || !track.exam_board) {
      // No board on this track (a custom/informal course) — there's no official spec to check against.
      return new Response(JSON.stringify({ items: [], fromCache: false, noSpec: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: topics } = await supabase.from("topics").select("id, title").eq("track_id", trackId);
    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ items: [], fromCache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const topicSubtopics = await Promise.all(
      topics.map(async (t: { id: string; title: string }) => {
        const { data: subs } = await supabase.from("subtopics").select("id, title").eq("topic_id", t.id);
        return { topic: t, subs: (subs || []) as { id: string; title: string }[] };
      }),
    );

    // Fan out one resolution per topic, in parallel — bounded per-topic timeout inside the resolver
    // keeps the total wall-clock close to the slowest single topic, not the sum of all of them.
    const results = await Promise.allSettled(
      topicSubtopics.map(({ topic, subs }) =>
        resolveTopicSpecChecklist(
          track.exam_board, track.subject, track.level, topic.title, subs.map((s) => s.title), LOVABLE_API_KEY,
        ).then((r) => ({ topic, subs, ...r })),
      ),
    );

    const rows: Record<string, unknown>[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { topic, subs, items, sourceUrl } = r.value;
      const idByTitle = new Map(subs.map((s) => [s.title, s.id]));
      for (const item of items) {
        const subtopicIds = item.subtopicTitles.map((t) => idByTitle.get(t)).filter((id): id is string => !!id);
        if (subtopicIds.length === 0) continue; // couldn't place it against a real subtopic — skip rather than show an orphaned item
        rows.push({
          track_id: trackId, topic_id: topic.id, code: item.code, text: item.text,
          rigor: item.rigor, evidence_requirements: item.evidenceRequirements,
          subtopic_ids: subtopicIds, source_url: sourceUrl,
        });
      }
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ items: [], fromCache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertErr } = await supabase.from("spec_checklist_items").insert(rows).select();
    if (insertErr) {
      console.error("spec_checklist_items insert failed:", insertErr);
      return new Response(JSON.stringify({ items: rows, fromCache: false, persisted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple items may already be satisfied by subtopics completed before the checklist existed —
    // tick those immediately rather than waiting for the next subtopic completion event.
    await tickSimpleItemsIfComplete(supabase, inserted as SpecItemRow[]);

    return new Response(JSON.stringify({ items: inserted, fromCache: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-spec-checklist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", items: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

type SpecItemRow = { id: string; rigor: string; subtopic_ids: string[]; ticked: boolean };

async function tickSimpleItemsIfComplete(supabase: ReturnType<typeof createClient>, items: SpecItemRow[]) {
  const simpleUnticked = items.filter((i) => i.rigor === "simple" && !i.ticked && i.subtopic_ids.length > 0);
  if (simpleUnticked.length === 0) return;
  const allSubIds = [...new Set(simpleUnticked.flatMap((i) => i.subtopic_ids))];
  const { data: subs } = await supabase.from("subtopics").select("id, status").in("id", allSubIds);
  const statusById = new Map(((subs || []) as { id: string; status: string }[]).map((s) => [s.id, s.status]));
  const toTick = simpleUnticked.filter((i) => i.subtopic_ids.every((id) => statusById.get(id) === "complete"));
  if (toTick.length === 0) return;
  await supabase.from("spec_checklist_items").update({ ticked: true, ticked_at: new Date().toISOString() }).in("id", toTick.map((i) => i.id));
}
