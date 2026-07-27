import { resolveTopicSpecChecklist } from "../_shared/specChecklistResolver.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { trackId } = await req.json();
    if (!trackId) {
      return new Response(JSON.stringify({ error: "trackId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Required env not configured");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: ownerCheck } = await supabase.from("learning_tracks").select("user_id").eq("id", trackId).maybeSingle();
    if (!ownerCheck || (ownerCheck as { user_id: string }).user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase.from("spec_checklist_items").select("*").eq("track_id", trackId);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ items: existing, fromCache: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: track } = await supabase.from("learning_tracks").select("*").eq("id", trackId).single();
    if (!track || !track.exam_board) {
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

    const results = await Promise.allSettled(
      topicSubtopics.map(({ topic, subs }) =>
        resolveTopicSpecChecklist(
          track.exam_board, track.subject, track.level, topic.title, subs.map((s) => s.title),
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
        if (subtopicIds.length === 0) continue;
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
