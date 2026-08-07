// Ingests one real exam/competition paper into the reference_questions corpus (STEP, BMO, BPhO, and
// further afield). Admin-only, invoked by scripts/ingest-reference-paper.mjs — PDF text extraction
// can't happen inside Deno (see specResolver.ts's unpdf note), so the caller has already extracted
// raw_text locally; this function's job is: mirror the original PDF, segment+tag via one AI call, and
// store. See docs context: supabase/migrations/20260805150000_reference_questions.sql.
//
// The original PDF is ALWAYS kept (mirrored to storage) — diagrams are never AI-reconstructed, only
// ever shown from the real source page, so losing the original would mean losing the only safe way to
// display a diagram-bearing question.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { getAIConfig } from "../_shared/aiConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "reference-papers";
const MAX_PDF_BYTES = 8 * 1024 * 1024; // same cap pastPaperResolver.ts uses, for the same reason

type IngestedQuestion = {
  question_number: string;
  topic_tags: string[];
  difficulty: string;
  question_text: string;
  solution_text: string | null;
};

// Page images are the primary source, not extracted text — a huge share of the real corpus (older
// papers especially) is scanned photocopies with no text layer at all (confirmed directly: pdf-parse's
// text extraction on a real 2007 STEP paper returned 128 characters of nothing). Traditional OCR is
// notoriously unreliable on mathematical notation (fractions, superscripts, symbols); a vision-capable
// model reading the page image directly does far better, and works identically whether the source paper
// is scanned or digitally typeset — so there's no need to branch on which one it is.
const SEGMENT_SYSTEM_PROMPT = `You are given page images of one real exam/competition paper (it may be a
scan or a digital original — read it exactly as printed either way) and, if available, raw text
mechanically extracted from the same PDF (may be empty or unreliable for scanned pages — use it only as
a cross-check, the images are the source of truth).

Transcribe every question directly from the images into clean, correct LaTeX for all mathematical
notation. Use $...$ for inline math and $$...$$ for display math. Preserve the source's typographic
emphasis exactly as printed: wrap bold text in **double asterisks** and italic prose (not math — math
variables are already italic by LaTeX convention and need no markup) in *single asterisks*. Do not add
emphasis that isn't in the source, and do not skip emphasis that is.

Split the paper into its individual numbered questions, preserving multi-part structure ((i), (ii),
(iii)...) within a single question's text — put each numbered or lettered sub-part on its own line so
the structure is visible — rather than splitting sub-parts into separate questions. If
the paper has labelled sections (e.g. "Section A: Pure Mathematics"), use them as a strong signal for
topic tagging, but tag topics at the level of actual mathematical/physical content (e.g. "binomial
expansion", "projectile motion"), not just the section name.

If a question includes a genuine DIAGRAM (a figure the student must read, not just text/equations),
set "has_diagram": true for it — never attempt to describe or transcribe the diagram itself, it will be
shown to students as the original page image, not reconstructed.

Return ONLY JSON, no commentary, no markdown fence:
{"questions": [{"question_number": string, "topic_tags": string[], "difficulty": "hard"|"very hard"|"extreme", "question_text": string, "solution_text": string|null, "has_diagram": boolean}]}

difficulty should reflect this exam's own register (these are advanced/olympiad-level papers, so
"hard" is the FLOOR, not the ceiling — reserve "extreme" for genuinely the hardest questions on the
paper). solution_text is null unless the source actually includes worked solutions/mark scheme — never
invent one.`;

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
    const source_competition = String(body?.source_competition || "").trim();
    const subject = String(body?.subject || "").trim();
    const source_url = String(body?.source_url || "").trim();
    const raw_text = String(body?.raw_text || ""); // supplementary cross-check only, may be empty for scans
    const year = typeof body?.year === "number" ? body.year : null;
    const license_note = body?.license_note ? String(body.license_note) : null;
    const pdf_base64: string | null = body?.pdf_base64 || null;
    // Base64 PNGs, one per page — the primary source the AI reads from. See SEGMENT_SYSTEM_PROMPT: works
    // identically for scanned or digitally-typeset pages, so the caller doesn't need to know which this is.
    const page_images: string[] = Array.isArray(body?.page_images) ? body.page_images.filter((s: unknown) => typeof s === "string") : [];

    if (!source_competition || !subject || !source_url || page_images.length === 0) {
      return json({ ok: false, errors: ["source_competition, subject, source_url and page_images are required"] }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ ok: false, errors: ["service role not configured"] }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // --- Cache check: never re-run AI (or re-mirror the PDF) for a paper already ingested. ---
    const { data: existing, error: existingErr } = await supabase
      .from("reference_questions")
      .select("*")
      .eq("source_url", source_url);
    if (existingErr) console.error("reference_questions lookup failed (will proceed to ingest):", existingErr);
    if (existing && existing.length > 0) {
      return json({ ok: true, inserted: 0, questions: existing, fromCache: true });
    }

    // --- Mirror the original PDF, if provided. Never blocks ingestion — a failed mirror just means
    // diagram-bearing questions from this paper fall back to linking source_url instead of an in-app image. ---
    let storagePath: string | null = null;
    if (pdf_base64) {
      try {
        const bytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
        if (bytes.byteLength <= MAX_PDF_BYTES) {
          const path = `${source_competition.replace(/[^a-zA-Z0-9]+/g, "-")}/${year || "unknown"}/${crypto.randomUUID()}.pdf`;
          const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
            contentType: "application/pdf",
            upsert: false,
          });
          if (!uploadErr) storagePath = path;
          else console.error("PDF mirror upload failed, continuing without it:", uploadErr);
        } else {
          console.error("PDF exceeds mirror size cap, continuing without it:", bytes.byteLength);
        }
      } catch (e) {
        console.error("PDF mirror decode/upload failed, continuing without it:", e);
      }
    }

    // --- Segment + tag via one multimodal AI call (turn tier — classification/extraction, not authoring).
    // Reads the page images directly rather than relying on extracted text, since that's unreliable or
    // absent for scanned papers and works uniformly for scanned/digital either way (see prompt comment). ---
    const ai = await getAIConfig("turn");
    const userContent: unknown[] = [
      {
        type: "text",
        text: `Paper: ${source_competition}${year ? ` ${year}` : ""} | Subject: ${subject}${raw_text ? `\n\nExtracted text (cross-check only, may be unreliable or empty):\n${raw_text.slice(0, 4000)}` : ""}`,
      },
      ...page_images.map((img) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${img}` } })),
    ];
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: SEGMENT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("segmentation AI error:", res.status, detail);
      // TEMPORARY debug: surface the upstream error detail to the caller so the pilot's first live
      // failure can be diagnosed without dashboard/log access. Revert to a generic message once resolved.
      return json({ ok: false, errors: [`segmentation model returned ${res.status}`, detail.slice(0, 1000)] }, 502);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return json({ ok: false, errors: ["segmentation response was not valid JSON"] }, 502);
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return json({ ok: false, errors: ["segmentation response was not valid JSON"] }, 502);
      }
    }

    const rawQuestions = (parsed as { questions?: unknown[] })?.questions;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      // TEMPORARY debug: same as the upstream-error branch above — surface what the model actually
      // returned so an empty/malformed result can be diagnosed without dashboard/log access.
      return json({ ok: false, errors: ["segmentation returned no questions", content.slice(0, 1500)] }, 502);
    }

    const questions: (IngestedQuestion & { has_diagram: boolean })[] = rawQuestions
      .map((q) => {
        const o = (q || {}) as Record<string, unknown>;
        return {
          question_number: String(o.question_number || "").trim(),
          topic_tags: Array.isArray(o.topic_tags) ? o.topic_tags.map(String).filter(Boolean) : [],
          difficulty: String(o.difficulty || "hard").trim(),
          question_text: String(o.question_text || "").trim(),
          solution_text: o.solution_text ? String(o.solution_text).trim() : null,
          has_diagram: o.has_diagram === true,
        };
      })
      .filter((q) => q.question_number && q.question_text);

    if (questions.length === 0) {
      return json({ ok: false, errors: ["segmentation produced no usable questions after validation"] }, 502);
    }

    const rows = questions.map((q) => ({
      source_competition,
      year,
      question_number: q.question_number,
      subject,
      topic_tags: q.topic_tags,
      difficulty: q.difficulty,
      question_text: q.question_text,
      solution_text: q.solution_text,
      has_diagram: q.has_diagram,
      storage_path: storagePath,
      source_url,
      license_note,
    }));

    const { data: inserted, error: insertErr } = await supabase.from("reference_questions").insert(rows).select();
    if (insertErr) {
      console.error("reference_questions insert failed:", insertErr);
      return json({ ok: false, errors: ["failed to store questions"] }, 500);
    }

    return json({ ok: true, inserted: inserted?.length || 0, questions: inserted, fromCache: false });
  } catch (e) {
    console.error("ingest-reference-paper error:", e);
    return json({ ok: false, errors: [e instanceof Error ? e.message : "Unknown error"] }, 500);
  }
});
