import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { resolvePastPapers } from "../_shared/pastPaperResolver.ts";
import { loadSources, mayMirror } from "../_shared/licensePolicy.ts";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "past-papers";

// Global past-paper cache, service-role write (mirrors the concepts-table pattern: search-before-create,
// server-only writes, so results accumulate across users instead of every track re-resolving from
// scratch). Any authenticated user can trigger a resolve for their track's board/subject/level; the
// first person to ask for a given combination pays the search cost, everyone after reads the cache.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { board, subject, level, examHint } = await req.json();
    if (!board || !subject) {
      return new Response(JSON.stringify({ error: "board and subject are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Service role not configured");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Cache check first — reuse whatever's already been resolved for this board+subject+level.
    let query = supabase.from("past_papers").select("*").eq("board", board).eq("subject", subject);
    query = level ? query.eq("level", level) : query.is("level", null);
    const { data: cached } = await query.order("year", { ascending: false });

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ papers: cached, fromCache: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nothing cached yet — resolve now (Tavily search + mirror-eligibility check per candidate).
    // examHint (typically the track's title) disambiguates board names that are ambiguous in general
    // web search on their own (e.g. "UAT" is dominated by "User Acceptance Testing" results) — the exam's
    // actual well-known common name, e.g. "TMUA", usually only lives in the title, not the board field.
    const resolved = await resolvePastPapers(board, subject, level || null, examHint || null);
    if (resolved.length === 0) {
      return new Response(JSON.stringify({ papers: [], fromCache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Licence gate. Being able to download a PDF says nothing about being allowed to host it —
    // "publicly available" is not a licence, and this function previously mirrored anything that
    // fetched successfully. Mirroring is now denied unless the URL matches a registered source whose
    // licence permits hosting; everything else still reaches the student as a link.
    const sources = await loadSources(supabase);

    const rows: Record<string, unknown>[] = [];
    for (const p of resolved) {
      let storagePath: string | null = null;
      if (p.bytes && p.contentType?.includes("pdf")) {
        const decision = mayMirror(p.sourceUrl, sources);
        if (!decision.allowed) {
          console.log(`[licence] not mirroring ${p.sourceUrl} — ${decision.reason}`);
        } else {
          const path = `${board}/${subject}/${level || "general"}/${crypto.randomUUID()}.pdf`;
          const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, p.bytes, {
            contentType: "application/pdf",
            upsert: false,
          });
          if (!uploadErr) storagePath = path;
          else console.error("mirror upload failed, falling back to link-out:", p.sourceUrl, uploadErr);
        }
      }
      rows.push({
        board, subject, level: level || null,
        title: p.title, year: p.year, paper_label: p.paperLabel,
        source_url: p.sourceUrl, storage_path: storagePath,
      });
    }

    const { data: inserted, error: insertErr } = await supabase.from("past_papers").insert(rows).select();
    if (insertErr) {
      console.error("past_papers insert failed:", insertErr);
      // Still return what we found even if persistence failed — better than a false empty state.
      return new Response(JSON.stringify({ papers: rows, fromCache: false, persisted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ papers: inserted, fromCache: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-past-papers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", papers: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
