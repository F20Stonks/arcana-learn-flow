// Shared primitives for pulling REAL text out of an official exam specification.
//
// Extracted from specChecklistResolver.ts, which discovered the load-bearing fact these encode:
//
//   a single flat search-and-truncate grab is nowhere near enough text to cover a real syllabus.
//
// One search returns at most MAX_EXCERPT_CHARS (6k, ~1000 words) from ONE page. A real A-Level
// specification is a hundred-page document. So anything that needs to reason about a whole syllabus
// must resolve PER TOPIC and fan out, turning 6k of spec into N x 6k. Both consumers of this module
// (the spec checklist, and syllabus tree authoring) exist because of that constraint.
//
// Everything here fails soft, always to null. A missing TAVILY_API_KEY, an unreachable page, a PDF
// where HTML was expected — every one of them means "no spec text for this topic", never an error.

const FETCH_TIMEOUT_MS = 8000;
export const MAX_EXCERPT_CHARS = 6000;
const MIN_USABLE_CHARS = 200;

export type SpecExcerpt = { text: string; sourceUrl: string };

export async function getTavilyKey(): Promise<string | null> {
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

/** Guards against "successful" fetches that returned a cookie banner or an empty shell. */
export function looksLikeUsableText(s: string | null | undefined): s is string {
  return !!s && s.replace(/\s/g, "").length >= MIN_USABLE_CHARS;
}

export async function fetchHtmlFallback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcanaLearnFlow/1.0)" },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("html")) return null;
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ").trim();
      return looksLikeUsableText(text) ? text : null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/**
 * Find real specification text for ONE topic.
 *
 * The topic title is quoted in the query deliberately: an unquoted search returns the syllabus
 * landing page every time, which is the generic overview that made the whole-syllabus grab useless.
 */
export async function searchTopicSpecText(
  board: string,
  subject: string,
  level: string | null,
  topicTitle: string,
  tavilyApiKey: string,
  signal?: AbortSignal,
): Promise<SpecExcerpt | null> {
  const query = `${board} ${level || ""} ${subject} specification "${topicTitle}" content statement assessment`
    .replace(/\s+/g, " ")
    .trim();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: 4, search_depth: "advanced", include_raw_content: true }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results: { title: string; url: string; raw_content?: string }[] = data.results || [];
    for (const r of results) {
      let text = looksLikeUsableText(r.raw_content) ? r.raw_content! : null;
      if (!text) text = await fetchHtmlFallback(r.url);
      if (text) return { text: text.slice(0, MAX_EXCERPT_CHARS), sourceUrl: r.url };
    }
    return null;
  } catch {
    return null;
  }
}
