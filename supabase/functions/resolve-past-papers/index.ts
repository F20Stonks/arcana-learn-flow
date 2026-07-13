import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolvePastPapers } from "../_shared/pastPaperResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "past-papers";

// Global past-paper cache, service-role write (mirrors the concepts-table pattern: search-before-create,
// server-only writes, so results accumulate across users instead of every track re-resolving from
// scratch). Any authenticated user can trigger a resolve for their track's board/subject/level; the
// first person to ask for a given combination pays the search cost, everyone after reads the cache.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { board, subject, level } = await req.json();
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
    const resolved = await resolvePastPapers(board, subject, level || null);
    if (resolved.length === 0) {
      return new Response(JSON.stringify({ papers: [], fromCache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: Record<string, unknown>[] = [];
    for (const p of resolved) {
      let storagePath: string | null = null;
      if (p.bytes && p.contentType?.includes("pdf")) {
        const path = `${board}/${subject}/${level || "general"}/${crypto.randomUUID()}.pdf`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, p.bytes, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (!uploadErr) storagePath = path;
        else console.error("mirror upload failed, falling back to link-out:", p.sourceUrl, uploadErr);
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
