// Query-time resolver for real official past exam papers, for arbitrary board/subject/level — no
// hardcoded per-board registry. Sibling to specResolver.ts (same fail-soft, Tavily-backed shape), but
// searches for the board's official past-paper archive instead of the specification, and returns a LIST
// of individual papers rather than one grounding text.
//
// Mirroring policy: a paper is only marked mirror-eligible if fetching it succeeds with a PDF content
// type, no auth/redirect-to-login, and a bounded size — i.e. confirmed freely, publicly downloadable,
// never anything paywalled. If a candidate fails that check, or the download itself fails, it still gets
// listed with just its source_url (the caller links out instead of hosting a copy).
//
// Requires the TAVILY_API_KEY secret (same one specResolver.ts uses). Fails soft to an empty list.

export type ResolvedPaper = {
  title: string;
  year: string | null;
  paperLabel: string | null;
  sourceUrl: string;
  bytes: Uint8Array | null; // present only when confirmed freely downloadable and under the size cap
  contentType: string | null;
};

const MAX_MIRROR_BYTES = 8 * 1024 * 1024; // 8MB cap — keep edge-function memory/time bounded
const FETCH_TIMEOUT_MS = 8000;
const OVERALL_TIMEOUT_MS = 20000;

function guessLabel(title: string, url: string): { year: string | null; paperLabel: string | null } {
  const hay = `${title} ${url}`;
  const yearMatch = hay.match(/\b(19|20)\d{2}\b/);
  const paperMatch = hay.match(/paper\s*([0-9]+[a-z]?)/i) || hay.match(/unit\s*([0-9]+[a-z]?)/i);
  return {
    year: yearMatch ? yearMatch[0] : null,
    paperLabel: paperMatch ? `Paper ${paperMatch[1]}` : null,
  };
}

// Confirms a URL is a freely, publicly downloadable PDF (no login wall, no paywall redirect) and
// downloads it if under the size cap. Returns null bytes (still a valid, link-out-only result) for
// anything that fails the check — the caller falls back to linking rather than hosting.
async function tryMirror(url: string): Promise<{ bytes: Uint8Array | null; contentType: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcanaLearnFlow/1.0)" },
        redirect: "follow",
      });
      if (!res.ok) return { bytes: null, contentType: null };
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("pdf")) return { bytes: null, contentType: null }; // not a direct PDF — treat as link-out only
      const lengthHeader = res.headers.get("content-length");
      if (lengthHeader && Number(lengthHeader) > MAX_MIRROR_BYTES) return { bytes: null, contentType };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_MIRROR_BYTES) return { bytes: null, contentType };
      return { bytes: new Uint8Array(buf), contentType };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { bytes: null, contentType: null };
  }
}

async function searchPastPapers(
  board: string,
  subject: string,
  level: string | null,
  tavilyApiKey: string,
  examHint?: string | null,
): Promise<ResolvedPaper[]> {
  // The board/administering-body name alone is often ambiguous in general web search (e.g. "UAT" is
  // dominated by "User Acceptance Testing" results, not the exam board of the same acronym) — the exam's
  // actual well-known common name (e.g. "TMUA"), when available, disambiguates far better than the formal
  // board name does. examHint carries that — typically derived from the track's title, not the board field.
  const query = `${examHint || ""} ${board} ${level || ""} ${subject} past papers pdf official`.replace(/\s+/g, " ").trim();

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      max_results: 8,
      search_depth: "advanced",
      include_raw_content: false, // we want document links here, not extracted text
    }),
  });

  if (!res.ok) {
    console.error("Tavily past-paper search failed:", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = await res.json();
  const results: { title: string; url: string }[] = data.results || [];

  // Only keep results that look like an actual paper document (PDF link, or a page whose URL/title
  // strongly suggests one) — a generic "past papers" landing page isn't a paper itself.
  const candidates = results.filter((r) => /\.pdf(\?|$)/i.test(r.url) || /paper|question|exam/i.test(r.title));

  const papers: ResolvedPaper[] = [];
  for (const r of candidates.slice(0, 6)) {
    const { year, paperLabel } = guessLabel(r.title, r.url);
    const { bytes, contentType } = await tryMirror(r.url);
    papers.push({ title: r.title, year, paperLabel, sourceUrl: r.url, bytes, contentType });
  }
  return papers;
}

// Best-effort end to end: any failure or missing config returns an empty list so callers fall back
// cleanly (an empty "no papers found yet" state, not an error).
async function getTavilyKey(): Promise<string | null> {
  const envKey = Deno.env.get("TAVILY_API_KEY");
  if (envKey) return envKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data } = await supabase.from("app_secrets").select("value").eq("key", "TAVILY_API_KEY").maybeSingle();
  return data?.value || null;
}

export async function resolvePastPapers(
  board: string,
  subject: string,
  level: string | null,
  examHint?: string | null,
): Promise<ResolvedPaper[]> {
  const tavilyApiKey = await getTavilyKey();
  if (!tavilyApiKey) return [];

  try {
    return await Promise.race([
      searchPastPapers(board, subject, level, tavilyApiKey, examHint),
      new Promise<ResolvedPaper[]>((resolve) => setTimeout(() => resolve([]), OVERALL_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error("resolvePastPapers failed:", e);
    return [];
  }
}
