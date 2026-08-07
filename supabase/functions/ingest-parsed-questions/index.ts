// Inserts already-parsed reference questions into the corpus. No AI call — unlike
// ingest-reference-paper, this is for sources that supply real, structured text directly (e.g. the STEP
// database's own LaTeX source), so there's nothing to transcribe or segment. This function's only job is
// the part a local script can't do: mirror each question's original image to storage (service role) and
// write rows (service role).
// Admin-gated the same way as ingest-reference-paper (reuses RECONCILE_ADMIN_USER_IDS).
//
// Upserts on (source_competition, year, question_number) — a real unique constraint, see migration
// 20260807123657 — rather than skipping whenever source_url already exists. That used to be safe (STEP
// rows are one-and-done), but Putnam/IMO's year-level source_url is shared across all of a year's
// problems, so a source_url-only check would have silently skipped every later re-ingestion of the same
// year instead of replacing earlier (e.g. index-only) content with better content.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "reference-papers";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type InputQuestion = {
  source_competition: string;
  year: number | null;
  question_number: string;
  subject: string;
  topic_tags: string[];
  question_text: string;
  has_diagram: boolean;
  source_url: string;
  license_note: string | null;
  image_base64: string | null; // optional per-question original page/crop, mirrored if present
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const callerId = await requireUser(req);
  if (!callerId) return unauthorized(corsHeaders);

  const adminList = (Deno.env.get("RECONCILE_ADMIN_USER_IDS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminList.length === 0 || !adminList.includes(callerId)) {
    return json({ error: "Forbidden: admin only" }, 403);
  }

  try {
    const body = await req.json();
    const inputQuestions: unknown[] = Array.isArray(body?.questions) ? body.questions : [];
    if (inputQuestions.length === 0) {
      return json({ ok: false, errors: ["questions array is required and must be non-empty"] }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ ok: false, errors: ["service role not configured"] }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const questions: InputQuestion[] = inputQuestions
      .map((q) => {
        const o = (q || {}) as Record<string, unknown>;
        return {
          source_competition: String(o.source_competition || "").trim(),
          year: typeof o.year === "number" ? o.year : null,
          question_number: String(o.question_number || "").trim(),
          subject: String(o.subject || "").trim(),
          topic_tags: Array.isArray(o.topic_tags) ? o.topic_tags.map(String).filter(Boolean) : [],
          question_text: String(o.question_text || "").trim(),
          has_diagram: o.has_diagram === true,
          source_url: String(o.source_url || "").trim(),
          license_note: o.license_note ? String(o.license_note) : null,
          image_base64: typeof o.image_base64 === "string" ? o.image_base64 : null,
        };
      })
      .filter((q) => q.source_competition && q.subject && q.question_text && q.source_url);

    if (questions.length === 0) {
      return json({ ok: false, errors: ["no valid questions after validation"] }, 400);
    }

    // Look up which of these rows already exist (by natural key) purely to report insert-vs-update
    // counts the way this endpoint always has — upsert() itself doesn't distinguish them.
    const keyOf = (r: { source_competition: string; year: number | null; question_number: string }) =>
      `${r.source_competition}::${r.year ?? ""}::${r.question_number}`;
    const competitions = [...new Set(questions.map((q) => q.source_competition))];
    const { data: existingRows, error: existingErr } = await supabase
      .from("reference_questions")
      .select("source_competition, year, question_number")
      .in("source_competition", competitions);
    if (existingErr) console.error("reference_questions lookup failed (will proceed to upsert):", existingErr);
    const existingKeys = new Set((existingRows || []).map((r) => keyOf(r)));

    const rows = [];
    for (const q of questions) {
      let storagePath: string | null = null;
      if (q.image_base64) {
        try {
          const bytes = Uint8Array.from(atob(q.image_base64), (c) => c.charCodeAt(0));
          if (bytes.byteLength <= MAX_IMAGE_BYTES) {
            const path = `${q.source_competition.replace(/[^a-zA-Z0-9]+/g, "-")}/${q.year || "unknown"}/${crypto.randomUUID()}.png`;
            const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
              contentType: "image/png",
              upsert: false,
            });
            if (!uploadErr) storagePath = path;
            else console.error("image mirror upload failed, continuing without it:", uploadErr);
          } else {
            console.error("image exceeds mirror size cap, continuing without it:", bytes.byteLength);
          }
        } catch (e) {
          console.error("image mirror decode/upload failed, continuing without it:", e);
        }
      }
      rows.push({
        source_competition: q.source_competition,
        year: q.year,
        question_number: q.question_number,
        subject: q.subject,
        topic_tags: q.topic_tags,
        difficulty: null,
        question_text: q.question_text,
        solution_text: null,
        has_diagram: q.has_diagram,
        storage_path: storagePath,
        source_url: q.source_url,
        license_note: q.license_note,
      });
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from("reference_questions")
      .upsert(rows, { onConflict: "source_competition,year,question_number" })
      .select("id");
    if (upsertErr) {
      console.error("reference_questions upsert failed:", upsertErr);
      return json({ ok: false, errors: ["failed to store questions", upsertErr.message] }, 500);
    }

    const insertedCount = rows.filter((r) => !existingKeys.has(keyOf(r))).length;
    const updatedCount = rows.length - insertedCount;
    return json({ ok: true, inserted: insertedCount, skipped: updatedCount, upserted: upserted?.length || 0 });
  } catch (e) {
    console.error("ingest-parsed-questions error:", e);
    return json({ ok: false, errors: [e instanceof Error ? e.message : "Unknown error"] }, 500);
  }
});
