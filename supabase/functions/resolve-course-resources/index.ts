// Resolves a COURSE's downloadable resources (past papers, example sheets) by enumerating a real
// archive index page and verifying every link, then records only what was actually reachable.
//
// Built for courses with no awarding body — "Mathematical Tripos Part IA", "MIT 18.02" — which the
// board/subject/level resolvers cannot express at all. See _shared/courseResolver.ts for why this
// enumerates an index page instead of trusting a relevance search.
//
// The response is a MANIFEST, including gaps. A caller that wants "did we get everything" gets an
// honest answer rather than a confident list, and nothing reaches the database unverified.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { getTavilyKey } from "../_shared/specSearch.ts";
import { resolveCourseResources } from "../_shared/courseResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { course, subject, level, what } = await req.json();
    if (!course || typeof course !== "string") {
      return new Response(JSON.stringify({ error: "course is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tavilyKey = await getTavilyKey();
    if (!tavilyKey) {
      // Loud, not soft: without a key this endpoint cannot do its one job, and silently returning an
      // empty manifest would read as "this course has no papers".
      console.error("resolve-course-resources: no TAVILY_API_KEY — cannot enumerate anything");
      return new Response(
        JSON.stringify({ error: "search is not configured", manifest: null }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const manifest = await resolveCourseResources(course, tavilyKey, what || "past papers");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let recorded = 0;
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const verified = manifest.resources.filter((r) => r.verified);

      // Skip anything already recorded — this endpoint is expected to be re-run as an archive grows,
      // and re-running it must not duplicate the whole archive each time.
      const { data: existing } = await supabase
        .from("past_papers")
        .select("source_url")
        .in("source_url", verified.map((r) => r.url).slice(0, 200));
      const seen = new Set(((existing || []) as { source_url: string }[]).map((r) => r.source_url));

      const rows = verified
        .filter((r) => !seen.has(r.url))
        .map((r) => ({
          // A university course has no awarding body, so the course itself is the identity here.
          board: course,
          subject: subject || "Mathematics",
          level: level || null,
          title: r.title,
          year: r.year,
          paper_label: r.kind === "example-sheet" ? "Example sheet" : r.year ? `Paper ${r.year}` : null,
          source_url: r.url,
        }));

      if (rows.length) {
        const { error } = await supabase.from("past_papers").insert(rows);
        if (error) {
          console.error("past_papers insert failed:", error.message);
          manifest.gaps.push(`database write failed: ${error.message}`);
        } else {
          recorded = rows.length;
        }
      }
    } else {
      manifest.gaps.push("service role unavailable — manifest returned but nothing was recorded");
    }

    console.log(
      "[course-resources]",
      JSON.stringify({
        course,
        indexUrl: manifest.indexUrl,
        discovered: manifest.discovered,
        verified: manifest.verified,
        recorded,
        gaps: manifest.gaps,
      }),
    );

    return new Response(JSON.stringify({ manifest, recorded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-course-resources error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
