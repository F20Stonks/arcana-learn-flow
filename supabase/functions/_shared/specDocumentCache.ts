// Caches the output of specSearch.ts's resolveSpecDocument by (board, subject, level), so grounding
// stops re-searching Tavily and re-parsing the source document on every run. See
// 20260809140000_spec_documents.sql for why this exists: without it, two grounding runs on the
// identical syllabus could legitimately resolve two different documents, which undermines
// syllabus_trees.coverage.source_url being a stable thing worth spot-checking.
//
// Deliberately a thin cache in front of resolveSpecDocument, not a replacement for it — the live
// resolve is still exactly what runs on a cache miss, using the exact same relevance-scoring logic.
// This module only decides whether that call is needed at all.

import { resolveSpecDocument, type SpecExcerpt } from "./specSearch.ts";

const norm = (s: string | null | undefined) => (s || "").trim();

/** Read a previously-resolved document for this identity, if one exists. Null on any failure or miss —
 *  every caller already has a defined fallback (resolve live), so this never needs to throw. */
// deno-lint-ignore no-explicit-any
export async function getCachedSpecDocument(
  supabase: any,
  board: string,
  subject: string,
  level: string | null,
): Promise<SpecExcerpt | null> {
  try {
    let query = supabase
      .from("spec_documents")
      .select("source_url, extracted_text")
      .eq("board", board)
      .eq("subject", subject);
    query = level ? query.eq("level", level) : query.is("level", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { text: data.extracted_text as string, sourceUrl: data.source_url as string };
  } catch (e) {
    console.error("getCachedSpecDocument failed:", e);
    return null;
  }
}

/** Write a freshly-resolved document to the cache. Best-effort — a failed write just means the next
 *  grounding run pays the live-resolve cost again, not a hard failure of the grounding itself. */
export async function cacheSpecDocument(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  board: string,
  subject: string,
  level: string | null,
  doc: SpecExcerpt,
  relevanceScore?: number,
): Promise<void> {
  try {
    const { error } = await supabase.from("spec_documents").insert({
      board,
      subject,
      level,
      source_url: doc.sourceUrl,
      extracted_text: doc.text,
      ...(relevanceScore !== undefined ? { relevance_score: relevanceScore } : {}),
    });
    if (error) console.error("cacheSpecDocument insert failed:", error);
  } catch (e) {
    console.error("cacheSpecDocument failed:", e);
  }
}

/**
 * Cache-checked replacement for calling resolveSpecDocument directly: reads the cache first, resolves
 * live and writes through on a miss. `topicTitles` is only used on a miss (resolveSpecDocument's own
 * relevance-scoring fingerprint) — a cache hit needs no topic list because the document is already
 * known to be the right one, having been scored once already when it was first cached.
 */
export async function resolveSpecDocumentCached(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  board: string,
  subject: string,
  level: string | null,
  tavilyApiKey: string,
  topicTitles: string[],
): Promise<SpecExcerpt | null> {
  const b = norm(board);
  const s = norm(subject);
  if (!b || !s) return resolveSpecDocument(board, subject, level, tavilyApiKey, topicTitles);

  const cached = await getCachedSpecDocument(supabase, b, s, level);
  if (cached) {
    console.log(`spec_documents cache hit: ${b} / ${s} / ${level || "(no level)"} -> ${cached.sourceUrl}`);
    return cached;
  }

  const resolved = await resolveSpecDocument(board, subject, level, tavilyApiKey, topicTitles);
  if (resolved) await cacheSpecDocument(supabase, b, s, level, resolved);
  return resolved;
}
