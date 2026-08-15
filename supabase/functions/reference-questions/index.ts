// The ONLY read path for reference_questions from the client — src/pages/QuestionBank.tsx no longer
// queries the table directly. Two reasons: (1) filter-chip counts used to require fetching the entire
// corpus into the browser just to tally it client-side, which is also exactly the shape a scraper wants
// (one authenticated request, whole table); (2) per-question full text (the "detail" mode) is the more
// valuable/copyright-sensitive payload, worth rate-limiting specifically, not just generically capping
// row counts.
//
// Any authenticated user may call this (requireUser only, not admin-gated) — this is a read surface for
// every signed-in user, including waitlisted ones (see App.tsx's ProtectedRoute on /question-bank).
//
// Rate limiting: a rolling weighted window logged in reference_question_requests. "list"/"facets" cost 1
// unit, "detail" (full question_text) costs 5 — a normal browsing session (open the page, click a few
// filters, read a dozen questions) lands well under the 300-unit/10-minute threshold; a script pulling
// hundreds of full questions hits it fast. Users who get blocked repeatedly (3+ times in 24h) escalate to
// a 60-minute window instead of 10 — a soft, self-resetting throttle rather than a manual ban list.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LIST_WEIGHT = 1;
const DETAIL_WEIGHT = 5;
const WINDOW_MINUTES = 10;
const ESCALATED_WINDOW_MINUTES = 60;
const THRESHOLD = 300;
const ESCALATION_BLOCK_COUNT = 3;
const IMAGE_BUCKET = "reference-papers";

// deno-lint-ignore no-explicit-any
async function checkRateLimit(supabase: any, userId: string, weight: number) {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: recentBlocks } = await supabase
    .from("reference_question_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("blocked", true)
    .gte("requested_at", dayAgo);

  const windowMinutes = (recentBlocks || 0) >= ESCALATION_BLOCK_COUNT ? ESCALATED_WINDOW_MINUTES : WINDOW_MINUTES;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("reference_question_requests")
    .select("weight")
    .eq("user_id", userId)
    .eq("blocked", false)
    .gte("requested_at", windowStart);

  const used = (rows || []).reduce((sum: number, r: { weight: number }) => sum + (r.weight || 0), 0);
  const blocked = used + weight > THRESHOLD;

  // Logged regardless of outcome — blocked attempts are what the escalation check above counts.
  await supabase.from("reference_question_requests").insert({ user_id: userId, weight, blocked });

  return { blocked, retryAfterMinutes: windowMinutes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const callerId = await requireUser(req);
  if (!callerId) return unauthorized(corsHeaders);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "service role not configured" }, 500);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const mode = body.mode;
  const weight = mode === "detail" ? DETAIL_WEIGHT : LIST_WEIGHT;

  const { blocked, retryAfterMinutes } = await checkRateLimit(supabase, callerId, weight);
  if (blocked) {
    return json(
      { error: "Too many requests — slow down a little and try again shortly.", retryAfterMinutes },
      429,
    );
  }

  // Narrowing helper — every filter arrives as untrusted JSON and the RPCs want NULL, not "".
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  if (mode === "facets") {
    const { data, error } = await supabase.rpc("reference_question_facets", {
      p_competition: str(body.competition),
      p_area: str(body.area),
      p_strand: str(body.strand),
    });
    if (error) return json({ error: error.message }, 500);
    return json({ facets: data });
  }

  if (mode === "list") {
    const filters = (body.filters || {}) as Record<string, unknown>;
    const { data, error } = await supabase.rpc("reference_question_list", {
      p_competition: str(filters.competition),
      p_area: str(filters.area),
      p_strand: str(filters.strand),
      p_topic: str(filters.topic),
      p_year: typeof filters.year === "number" ? filters.year : null,
      p_search: str(filters.search),
      p_status: ["unseen", "attempted", "solved"].includes(String(filters.status)) ? String(filters.status) : null,
      // Always the verified caller, never a client-supplied id — this is what scopes the solved/attempted
      // flags and the status filter to the person actually browsing.
      p_user_id: callerId,
      p_cursor: typeof body.cursor === "number" ? body.cursor : 0,
      p_limit: 60,
    });
    if (error) return json({ error: error.message }, 500);
    const rows = data || [];
    const totalCount = rows.length > 0 ? rows[0].total_count : 0;
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;
    const nextCursor = cursor + rows.length < totalCount ? cursor + rows.length : null;
    return json({
      questions: rows.map(({ total_count: _drop, ...q }: Record<string, unknown>) => q),
      totalCount,
      nextCursor,
    });
  }

  if (mode === "detail") {
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) return json({ error: "id is required" }, 400);
    const { data, error } = await supabase.from("reference_questions").select("*").eq("id", id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "not found" }, 404);

    let imageUrl: string | null = null;
    if (data.storage_path) {
      const { data: signed } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(data.storage_path, 3600);
      imageUrl = signed?.signedUrl || null;
    }

    // The caller's own progress on this question, so the detail page can show its status control already in
    // the right state instead of flashing "not started" and correcting itself.
    const { data: attempts } = await supabase
      .from("user_question_attempts")
      .select("is_completed")
      .eq("user_id", callerId)
      .eq("reference_question_id", id);
    const rows = attempts || [];
    const status = rows.length === 0
      ? "unseen"
      : rows.some((r: { is_completed: boolean }) => r.is_completed)
        ? "solved"
        : "attempted";

    // Canonical classification for the header chips — the raw source tags stay available on `question`
    // itself as provenance.
    const { data: cls } = await supabase
      .from("reference_question_classification")
      .select("area, strands, topics")
      .eq("question_id", id)
      .maybeSingle();

    return json({ question: data, imageUrl, status, attempts: rows.length, classification: cls || null });
  }

  // "How much of the bank have I done" — aggregates only over the caller's own attempts.
  if (mode === "progress") {
    const { data, error } = await supabase.rpc("reference_question_progress", { p_user_id: callerId });
    if (error) return json({ error: error.message }, 500);
    return json({ progress: data });
  }

  // The bank's only write path. Status is SELF-DECLARED: these are long-form proof questions with no answer
  // key in the corpus (zero rows have solution_text), so there is nothing to auto-grade against and
  // pretending otherwise would be dishonest progress.
  if (mode === "setStatus") {
    const id = typeof body.id === "string" ? body.id : null;
    const status = typeof body.status === "string" ? body.status : "";
    if (!id) return json({ error: "id is required" }, 400);
    if (!["unseen", "attempted", "solved"].includes(status)) return json({ error: "invalid status" }, 400);

    const { error } = await supabase.rpc("reference_question_set_status", {
      p_user_id: callerId,
      p_question_id: id,
      p_status: status,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ status });
  }

  return json({ error: "unknown mode" }, 400);
});
