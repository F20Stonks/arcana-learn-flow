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

import { getAIConfig, getAIConfigSync } from "./aiConfig.ts";
// The search/fetch primitives below used to live in this file. They moved to specSearch.ts unchanged
// when syllabus tree authoring needed the same per-topic resolution — the constraint in the header
// comment above is not specific to checklists, and two copies of it would drift.
import { getTavilyKey, searchTopicSpecText } from "./specSearch.ts";
import { aiFetch } from "./aiFetch.ts";

const OVERALL_TIMEOUT_MS = 18000;

export type SpecChecklistItem = {
  code: string | null;
  text: string;
  rigor: "simple" | "complex";
  evidenceRequirements: string[];
  subtopicTitles: string[];
};

async function segmentIntoItems(
  specText: string, sourceUrl: string, topicTitle: string, subtopicTitles: string[],
): Promise<{ items: SpecChecklistItem[]; sourceUrl: string } | null> {
  const ai = getAIConfigSync();
  const res = await aiFetch(ai, {
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

export async function resolveTopicSpecChecklist(
  board: string, subject: string, level: string | null, topicTitle: string, subtopicTitles: string[],
): Promise<{ items: SpecChecklistItem[]; sourceUrl: string | null }> {
  await getAIConfig();
  const tavilyApiKey = await getTavilyKey();
  if (!tavilyApiKey || subtopicTitles.length === 0) return { items: [], sourceUrl: null };

  const run = async (): Promise<{ items: SpecChecklistItem[]; sourceUrl: string | null }> => {
    const found = await searchTopicSpecText(board, subject, level, topicTitle, tavilyApiKey);
    if (!found) return { items: [], sourceUrl: null };
    const segmented = await segmentIntoItems(found.text, found.sourceUrl, topicTitle, subtopicTitles);
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
