// Resolves a REAL spec-derived checklist for one topic at a time (not once for the whole track) — a
// single flat search-and-truncate grab is nowhere near enough text to cover a real syllabus's full line
// items, so this runs per topic instead and the caller fans them out in parallel.
//
// Each item gets a "rigor" tag pulled from the spec's OWN wording, not a hardcoded rule: a bare skill
// ("expand brackets") is "simple" — ordinary subtopic completion is enough evidence. A bundled, multi-part
// requirement (derivation + a named method + a calculation) is "complex" — its own text is broken into the
// distinct things it demands, so ticking it later can check for each of them rather than a single flag.
//
// Fails soft to an empty list (no TAVILY_API_KEY, no usable search result, any error) so a topic simply
// shows no checklist rather than breaking the page.

import { AI_GATEWAY_URL, AI_MODEL_CHEAP } from "./aiGateway.ts";

const GATEWAY_URL = AI_GATEWAY_URL;
const FETCH_TIMEOUT_MS = 8000;
const OVERALL_TIMEOUT_MS = 18000;
const MAX_EXCERPT_CHARS = 6000;
const MIN_USABLE_CHARS = 200;

export type SpecChecklistItem = {
  code: string | null;
  text: string;
  rigor: "simple" | "complex";
  evidenceRequirements: string[];
  subtopicTitles: string[]; // matched back to subtopic ids by the caller, which knows the real ids
};

function looksLikeUsableText(s: string | null | undefined): s is string {
  return !!s && s.replace(/\s/g, "").length >= MIN_USABLE_CHARS;
}

async function fetchHtmlFallback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcanaLearnFlow/1.0)" } });
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

async function searchTopicSpecText(
  board: string, subject: string, level: string | null, topicTitle: string, tavilyApiKey: string,
): Promise<{ text: string; sourceUrl: string } | null> {
  const query = `${board} ${level || ""} ${subject} specification "${topicTitle}" content statement assessment`.replace(/\s+/g, " ").trim();
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: 4, search_depth: "advanced", include_raw_content: true }),
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
}

async function segmentIntoItems(
  specText: string, sourceUrl: string, topicTitle: string, subtopicTitles: string[], lovableApiKey: string,
): Promise<{ items: SpecChecklistItem[]; sourceUrl: string } | null> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL_CHEAP,
      messages: [
        {
          role: "system",
          content: `You extract a checklist of discrete requirement line items from a real official exam specification excerpt, for the topic "${topicTitle}".

For EACH distinct requirement in the excerpt (skip anything not part of this topic):
- "code": the spec's own numbering for it if visible (e.g. "1.1"), else null.
- "text": the requirement, quoted or very closely paraphrased from the actual spec text — do not invent content not present in the excerpt.
- "rigor": "simple" if it names ONE bare skill/fact/notation. "complex" if it bundles multiple distinct things (e.g. a derivation, a specific required method, AND a calculation) — read this off how much the item's OWN wording demands, don't guess independently.
- "evidenceRequirements": for "complex" items only, break out the distinct things it demands as short phrases (e.g. ["derivation of the equation shown", "conservation of momentum method used", "calculation performed"]). Empty array for "simple" items.
- "subtopicTitles": which of these existing subtopics (choose only from this exact list, verbatim) this requirement belongs to: ${JSON.stringify(subtopicTitles)}. Usually one, sometimes more; empty array if none clearly match.

Respond ONLY with valid JSON: {"items": [{"code": string|null, "text": string, "rigor": "simple"|"complex", "evidenceRequirements": string[], "subtopicTitles": string[]}]}
If the excerpt doesn't actually contain real spec requirement content for this topic, respond {"items": []}.`,
        },
        { role: "user", content: specText },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const items: SpecChecklistItem[] = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
      code: it.code ?? null,
      text: String(it.text || "").trim(),
      rigor: it.rigor === "complex" ? "complex" : "simple",
      evidenceRequirements: Array.isArray(it.evidenceRequirements) ? it.evidenceRequirements.map((e: any) => String(e)) : [],
      subtopicTitles: Array.isArray(it.subtopicTitles) ? it.subtopicTitles.map((s: any) => String(s)) : [],
    })).filter((it: SpecChecklistItem) => it.text.length > 0) : [];
    return { items, sourceUrl };
  } catch {
    return null;
  }
}

// Best-effort end to end for ONE topic: any failure/missing config/no-usable-text returns an empty
// result so the caller's Promise.allSettled fan-out treats it as "nothing found for this topic" rather
// than failing the whole checklist build.
export async function resolveTopicSpecChecklist(
  board: string, subject: string, level: string | null, topicTitle: string, subtopicTitles: string[],
  lovableApiKey: string,
): Promise<{ items: SpecChecklistItem[]; sourceUrl: string | null }> {
  const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyApiKey || subtopicTitles.length === 0) return { items: [], sourceUrl: null };

  const run = async (): Promise<{ items: SpecChecklistItem[]; sourceUrl: string | null }> => {
    const found = await searchTopicSpecText(board, subject, level, topicTitle, tavilyApiKey);
    if (!found) return { items: [], sourceUrl: null };
    const segmented = await segmentIntoItems(found.text, found.sourceUrl, topicTitle, subtopicTitles, lovableApiKey);
    if (!segmented) return { items: [], sourceUrl: found.sourceUrl };
    return { items: segmented.items, sourceUrl: segmented.sourceUrl };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<{ items: SpecChecklistItem[]; sourceUrl: string | null }>((resolve) =>
        setTimeout(() => resolve({ items: [], sourceUrl: null }), OVERALL_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error(`resolveTopicSpecChecklist failed for topic "${topicTitle}":`, e);
    return { items: [], sourceUrl: null };
  }
}
