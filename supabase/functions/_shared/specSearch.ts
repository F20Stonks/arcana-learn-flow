// Shared primitives for pulling REAL text out of an official exam specification.
//
// Extracted from specChecklistResolver.ts, which discovered the load-bearing fact these encode:
//
//   a single flat search-and-truncate grab is nowhere near enough text to cover a real syllabus.
//
// A specification is usually published as ONE document — commonly a PDF, sometimes an HTML page —
// and that document is the ENTIRE syllabus for the goal, not a per-topic thing. `resolveSpecDocument`
// finds and reads that one document in full. `searchTopicSpecText` is the older, narrower primitive
// (search per topic, cap at MAX_EXCERPT_CHARS) kept for specChecklistResolver.ts, which is tuned
// around per-topic excerpts and is unrelated to this change.
//
// NO DOMAIN RESTRICTION, ON PURPOSE. The real specification is often mirrored off the exam board's
// own site — a revision site, a school's own upload, a tuition company's copy — and those mirrors are
// frequently the ONLY copy a search actually surfaces well. Judge a result by whether it IS the real
// document (long, structured, on-topic), never by which domain it came from.
//
// FORMAT-AGNOSTIC, ON PURPOSE. An earlier version of this file only accepted `content-type: html` in
// its fetch fallback, which silently discarded every PDF result — and specifications are very
// frequently PDFs. That was the actual bug behind weak grounding, not the search itself.
//
// Everything here fails soft, always to null. A missing TAVILY_API_KEY, an unreachable page, a format
// neither parser can read — every one of them means "no spec text here", never an error.

const FETCH_TIMEOUT_MS = 8000;
/** Generous timeout for a large PDF fetch + parse — the whole point is these are big documents. */
const DOCUMENT_FETCH_TIMEOUT_MS = 25000;
export const MAX_EXCERPT_CHARS = 6000;
/** Sanity ceiling on a whole resolved document, not a target — chunking (see chunkText) is what
 *  actually makes a document this size usable. Guards against a pathological 10MB PDF eating the
 *  whole grounding time budget on one document. */
export const MAX_DOCUMENT_CHARS = 400_000;
const MIN_USABLE_CHARS = 200;
/** Below this, a "successfully extracted" document is almost certainly a landing page or an error
 *  page that happened to parse, not the actual specification. */
const MIN_DOCUMENT_CHARS = 3000;

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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

/**
 * Extract text from a PDF buffer using pdf-parse (already a project dependency — see
 * scripts/rasterize-one.mjs for the Node-side precedent of the same library).
 *
 * Loaded via dynamic `npm:` import so the cost of loading it is only ever paid on a path that
 * actually hit a PDF, not on every HTML fetch. Deno's npm compatibility layer is the same mechanism
 * already used for `npm:@supabase/supabase-js` elsewhere in this codebase; pdf-parse ships a
 * non-Node-specific build (see its `dist/pdf-parse/web` target) specifically because it does not
 * depend on Node-only APIs like `fs`, which is what makes it a reasonable bet under Deno.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const { PDFParse } = await import("npm:pdf-parse@2.4.5");
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text || null;
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    console.error("PDF text extraction failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Fetch a URL and extract whatever real text it holds, PDF or HTML — the two formats a
 * specification is actually published in. Anything else (an image, a .docx with no parser here)
 * fails soft to null, same as an unreachable page.
 */
export async function fetchDocumentFallback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOCUMENT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcanaLearnFlow/1.0)" },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const text = await extractPdfText(bytes);
        return looksLikeUsableText(text) ? text : null;
      }
      if (contentType.includes("html") || contentType === "" || url.toLowerCase().endsWith(".html")) {
        const text = stripHtml(await res.text());
        return looksLikeUsableText(text) ? text : null;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/** Retained for specChecklistResolver.ts, which is tuned around HTML per-topic excerpts and predates
 *  this change. New callers should use `fetchDocumentFallback`, which also reads PDFs. */
export const fetchHtmlFallback = fetchDocumentFallback;

/**
 * Find real specification text for ONE topic. Kept for specChecklistResolver.ts.
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
      if (!text) text = await fetchDocumentFallback(r.url);
      if (text) return { text: text.slice(0, MAX_EXCERPT_CHARS), sourceUrl: r.url };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Find and read the ONE document that IS the specification for this syllabus, in full.
 *
 * Tries every search result in order (not just the first "usable" one) and keeps the LONGEST
 * extracted text across all of them. Length is the signal that matters here: a landing page or a
 * "what's in this spec" summary article both parse successfully and both pass `looksLikeUsableText`,
 * but neither is anywhere near `MIN_DOCUMENT_CHARS` — only the actual specification document is.
 */
export async function resolveSpecDocument(
  board: string,
  subject: string,
  level: string | null,
  tavilyApiKey: string,
): Promise<SpecExcerpt | null> {
  const query = `${board} ${level || ""} ${subject} full specification pdf`.replace(/\s+/g, " ").trim();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: 8, search_depth: "advanced", include_raw_content: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results: { title: string; url: string; raw_content?: string }[] = data.results || [];

    let best: SpecExcerpt | null = null;
    for (const r of results) {
      let text = looksLikeUsableText(r.raw_content) ? r.raw_content! : null;
      if (!text) text = await fetchDocumentFallback(r.url);
      if (!text || text.length < MIN_DOCUMENT_CHARS) continue;
      if (!best || text.length > best.text.length) {
        best = { text: text.slice(0, MAX_DOCUMENT_CHARS), sourceUrl: r.url };
      }
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Split a large document into overlapping chunks small enough for one model call each.
 *
 * The overlap exists because a specification's content statements are frequently split across a
 * page boundary in the source document — without overlap, a topic whose defining sentence straddles
 * a chunk boundary would appear in neither chunk's context and never ground.
 */
export function chunkText(text: string, chunkChars: number, overlapChars: number): string[] {
  if (text.length <= chunkChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlapChars;
  }
  return chunks;
}
