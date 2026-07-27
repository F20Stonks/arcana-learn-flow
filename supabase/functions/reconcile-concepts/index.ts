// Admin / manually-triggered concept-registry dedup safety net (framework §7d / §8).
// The AI-tagged, global concept registry can fragment into near-duplicate rows; this function is the
// human-in-the-loop way to find and fix them. Two actions:
//   { "action": "scan", "threshold"?: number }         -> dry run: list suspected duplicate pairs.
//   { "action": "merge", "canonicalId", "duplicateId" } -> repoint every reference dup->canonical, then
//                                                          delete the duplicate concept row.
// Service-role only. Not wired into any user-facing UI — invoke deliberately (Supabase function invoke /
// curl) when the scan surfaces a real duplicate. The optional atomic SQL merge_concepts() function is a
// deferred migration; TypeScript repointing is sufficient for v1.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ConceptRow = { id: string; name: string; type: string; definition: string | null; aliases: string[] | null };

const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const formsOf = (c: ConceptRow) => [c.name, ...(c.aliases || [])].map(norm).filter(Boolean);
const tokens = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
function jaccard(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
function pairScore(a: ConceptRow, b: ConceptRow): number {
  const fa = new Set(formsOf(a)), fb = formsOf(b);
  if (fb.some((f) => fa.has(f))) return 1; // shared name/alias form = certain duplicate
  let best = jaccard(a.name, b.name);
  for (const x of formsOf(a)) for (const y of fb) best = Math.max(best, jaccard(x, y));
  return best;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);
  const adminList = (Deno.env.get("RECONCILE_ADMIN_USER_IDS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminList.length === 0 || !adminList.includes(userId)) {
    return json({ error: "Forbidden: admin only" }, 403);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "service role not configured" }, 500);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "scan";

    if (action === "scan") {
      const threshold = typeof body.threshold === "number" ? body.threshold : 0.5;
      const { data } = await supabase.from("concepts").select("id, name, type, definition, aliases");
      const concepts = (data || []) as ConceptRow[];
      const pairs: { a: ConceptRow; b: ConceptRow; score: number }[] = [];
      for (let i = 0; i < concepts.length; i++) {
        for (let j = i + 1; j < concepts.length; j++) {
          const score = pairScore(concepts[i], concepts[j]);
          if (score >= threshold) pairs.push({ a: concepts[i], b: concepts[j], score });
        }
      }
      pairs.sort((x, y) => y.score - x.score);
      return json({
        count: pairs.length,
        suspected_duplicates: pairs.map((p) => ({
          score: Number(p.score.toFixed(3)),
          a: { id: p.a.id, name: p.a.name, type: p.a.type },
          b: { id: p.b.id, name: p.b.name, type: p.b.type },
        })),
      });
    }

    if (action === "merge") {
      const canonicalId = body.canonicalId as string;
      const duplicateId = body.duplicateId as string;
      if (!canonicalId || !duplicateId || canonicalId === duplicateId) {
        return json({ error: "provide distinct canonicalId and duplicateId" }, 400);
      }
      const { data: canon } = await supabase.from("concepts").select("id").eq("id", canonicalId).maybeSingle();
      const { data: dup } = await supabase.from("concepts").select("id").eq("id", duplicateId).maybeSingle();
      if (!canon || !dup) return json({ error: "canonical or duplicate concept not found" }, 404);

      const report = { subtopic_concepts_repointed: 0, subtopic_concepts_deduped: 0, user_knowledge_repointed: 0, user_knowledge_deduped: 0, notes_updated: 0 };

      // subtopic_concepts: UNIQUE(subtopic_id, concept_id, role) — repoint, delete on would-be collision.
      const { data: canonSc } = await supabase.from("subtopic_concepts").select("subtopic_id, role").eq("concept_id", canonicalId);
      const canonScKeys = new Set((canonSc || []).map((r: any) => `${r.subtopic_id}|${r.role}`));
      const { data: dupSc } = await supabase.from("subtopic_concepts").select("id, subtopic_id, role").eq("concept_id", duplicateId);
      for (const row of (dupSc || []) as any[]) {
        if (canonScKeys.has(`${row.subtopic_id}|${row.role}`)) {
          await supabase.from("subtopic_concepts").delete().eq("id", row.id);
          report.subtopic_concepts_deduped++;
        } else {
          await supabase.from("subtopic_concepts").update({ concept_id: canonicalId }).eq("id", row.id);
          canonScKeys.add(`${row.subtopic_id}|${row.role}`);
          report.subtopic_concepts_repointed++;
        }
      }

      // user_concept_knowledge: UNIQUE(user_id, concept_id) — repoint, delete on would-be collision.
      const { data: canonUck } = await supabase.from("user_concept_knowledge").select("user_id").eq("concept_id", canonicalId);
      const canonUckUsers = new Set((canonUck || []).map((r: any) => r.user_id));
      const { data: dupUck } = await supabase.from("user_concept_knowledge").select("id, user_id").eq("concept_id", duplicateId);
      for (const row of (dupUck || []) as any[]) {
        if (canonUckUsers.has(row.user_id)) {
          await supabase.from("user_concept_knowledge").delete().eq("id", row.id);
          report.user_knowledge_deduped++;
        } else {
          await supabase.from("user_concept_knowledge").update({ concept_id: canonicalId }).eq("id", row.id);
          canonUckUsers.add(row.user_id);
          report.user_knowledge_repointed++;
        }
      }

      // notes.linked_concept_ids (UUID[]): swap dup -> canonical, dedup the array.
      const { data: notes } = await supabase.from("notes").select("id, linked_concept_ids").contains("linked_concept_ids", [duplicateId]);
      for (const n of (notes || []) as any[]) {
        const next = [...new Set((n.linked_concept_ids || []).map((id: string) => (id === duplicateId ? canonicalId : id)))];
        await supabase.from("notes").update({ linked_concept_ids: next }).eq("id", n.id);
        report.notes_updated++;
      }

      const { error: delErr } = await supabase.from("concepts").delete().eq("id", duplicateId);
      if (delErr) return json({ error: "repointed references but failed to delete duplicate row", detail: delErr.message, report }, 500);

      return json({ merged: true, canonicalId, duplicateId, report });
    }

    return json({ error: `unknown action "${action}" (use "scan" or "merge")` }, 400);
  } catch (e) {
    console.error("reconcile-concepts error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
