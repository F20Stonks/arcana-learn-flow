// Query-time framework for grounding track generation in a real official exam specification,
// for arbitrary exam boards/subjects/levels — no hardcoded per-board registry.
//
// Pipeline:
//   1. extractBoardSubjectLevel — small LLM call, pulls {board, subject, level} out of the free-text
//      onboarding conversation (works for any board the student names, not a fixed list).
//   2. detectExamFamily — regex pass over the conversation + extracted fields against a small table of
//      SEARCH HINTS for the major non-UK exam families (JEE Main/Advanced, NEET, AP, IB, CBSE,
//      Cambridge International, SAT), whose official syllabi live on portals that the generic
//      "specification" query rarely surfaces (coaching-site copies dominate those results instead).
//      A hit steers the search at the official publisher's domains using that body's own name for the
//      document ("syllabus" vs "course and exam description" vs "subject brief"); no hit changes
//      nothing about the existing UK-and-everything-else path.
//   3. searchOfficialSpec — Tavily web search for that board+subject+level's official specification:
//      the domain-steered attempt first when a family was detected, then the original generic attempt.
//      Tavily extracts readable text server-side per result (`raw_content`), including from PDFs, so
//      this avoids parsing PDFs inside the Deno edge runtime — unpdf, the only real option there, has
//      a documented unresolved failure in Supabase Edge Functions specifically:
//      https://github.com/unjs/unpdf/issues/3
//   4. A lightweight own-fetch HTML fallback if Tavily didn't return usable raw_content for an
//      otherwise-good HTML result.
//
// Every step is wrapped to fail soft: if TAVILY_API_KEY isn't configured, or nothing usable is found,
// resolveOfficialSpec returns null and jarvis-director falls back to its prior ungrounded behaviour.

import { getAIConfig, getAIConfigSync } from "./aiConfig.ts";

type BoardSubjectLevel = { board: string | null; subject: string | null; level: string | null };

export type ResolvedSpec = {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  board: string;
  subject: string;
  level: string | null;
};

const OVERALL_TIMEOUT_MS = 15000;
const FAMILY_OVERALL_TIMEOUT_MS = 20000;
const MAX_EXCERPT_CHARS = 6000;
const MIN_USABLE_CHARS = 300;

// --- Exam-family search hints --------------------------------------------------------------------
type ExamFamily = {
  family: string;
  pattern: RegExp;
  officialDomains: string[];
  queryPhrase: string;
  boardFallback: string;
};

const EXAM_FAMILIES: ExamFamily[] = [
  {
    family: "JEE Advanced",
    pattern: /\bjee[\s-]*adv(?:anced)?\b/i,
    officialDomains: ["jeeadv.ac.in"],
    queryPhrase: "official syllabus",
    boardFallback: "IIT (JEE Advanced)",
  },
  {
    family: "JEE Main",
    pattern: /\b(?:iit[\s-]*)?jee\b/i,
    officialDomains: ["nta.ac.in", "nta.nic.in"],
    queryPhrase: "official syllabus",
    boardFallback: "NTA",
  },
  {
    family: "NEET",
    pattern: /\bneet\b/i,
    officialDomains: ["nta.ac.in", "nta.nic.in"],
    queryPhrase: "official syllabus",
    boardFallback: "NTA",
  },
  {
    family: "AP",
    pattern: /\badvanced placement\b|\bap\s+(?:calc(?:ulus)?|physics|chem(?:istry)?|bio(?:logy)?|stat(?:istics)?|precalc(?:ulus)?|computer science)\b/i,
    officialDomains: ["collegeboard.org"],
    queryPhrase: "course and exam description course content",
    boardFallback: "College Board",
  },
  {
    family: "IB",
    pattern: /\binternational baccalaureate\b|\bib\s+(?:dp|diploma|math|maths|mathematics|physics|chem(?:istry)?|bio(?:logy)?)\b|\bmaths?\s+(?:aa|ai)\b|\banalysis (?:and|&) approaches\b|\bapplications (?:and|&) interpretation\b/i,
    officialDomains: ["ibo.org"],
    queryPhrase: "subject brief syllabus outline",
    boardFallback: "International Baccalaureate",
  },
  {
    family: "CBSE",
    pattern: /\bcbse\b/i,
    officialDomains: ["cbseacademic.nic.in", "cbse.gov.in"],
    queryPhrase: "curriculum syllabus",
    boardFallback: "CBSE",
  },
  {
    family: "Cambridge International",
    pattern: /\bcaie\b|\bcie\b|\bcambridge international\b|\bcambridge\s+(?:igcse|o[\s-]?level|as[\s-]?level|a[\s-]?levels?|pre[\s-]?u)\b/i,
    officialDomains: ["cambridgeinternational.org"],
    queryPhrase: "official syllabus",
    boardFallback: "Cambridge International (CIE)",
  },
  {
    family: "SAT",
    pattern: /\bSAT\b|\b[Dd]igital\s+[Ss][Aa][Tt]\b|\bsat\s+(?:math|exam|test|prep)\b/,
    officialDomains: ["collegeboard.org"],
    queryPhrase: "test specifications assessed skills math domains",
    boardFallback: "College Board",
  },
];

function detectExamFamily(haystack: string): ExamFamily | null {
  for (const f of EXAM_FAMILIES) {
    if (f.pattern.test(haystack)) return f;
  }
  return null;
}

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

async function extractBoardSubjectLevel(
  messages: { role: string; content: string }[],
): Promise<BoardSubjectLevel> {
  const ai = getAIConfigSync();
  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const res = await fetch(ai.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `Extract the exam board, subject, and level the student is describing, from this onboarding conversation. Respond ONLY with JSON: {"board": string|null, "subject": string|null, "level": string|null}. Use null for any field not clearly stated or implied. "board" is the awarding/exam body (e.g. Edexcel, AQA, OCR, WJEC, CIE, IB, College Board, state name for a US curriculum, etc.) — null if no specific board is identifiable. Do not guess a board if none is implied.`,
        },
        { role: "user", content: conversation },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return { board: null, subject: null, level: null };
  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      board: parsed.board || null,
      subject: parsed.subject || null,
      level: parsed.level || null,
    };
  } catch {
    return { board: null, subject: null, level: null };
  }
}

function looksLikeUsableText(s: string | null | undefined): s is string {
  return !!s && s.replace(/\s/g, "").length >= MIN_USABLE_CHARS;
}

async function fetchHtmlFallback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
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
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return looksLikeUsableText(text) ? text : null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

async function tavilySearchForSpec(
  query: string,
  tavilyApiKey: string,
  includeDomains?: string[],
): Promise<{ text: string; sourceUrl: string; sourceTitle: string } | null> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: "advanced",
      include_raw_content: true,
      ...(includeDomains && includeDomains.length > 0 ? { include_domains: includeDomains } : {}),
    }),
  });

  if (!res.ok) {
    console.error("Tavily search failed:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json();
  const results: { title: string; url: string; raw_content?: string }[] = data.results || [];

  for (const r of results) {
    let text = looksLikeUsableText(r.raw_content) ? r.raw_content! : null;
    if (!text) text = await fetchHtmlFallback(r.url);
    if (text) {
      return { text: text.slice(0, MAX_EXCERPT_CHARS), sourceUrl: r.url, sourceTitle: r.title };
    }
  }

  return null;
}

async function searchOfficialSpec(
  board: string,
  subject: string,
  level: string | null,
  tavilyApiKey: string,
  family: ExamFamily | null,
): Promise<ResolvedSpec | null> {
  if (family) {
    const steeredQuery =
      `${family.family} ${level || ""} ${subject === family.family ? "" : subject} ${family.queryPhrase}`
        .replace(/\s+/g, " ")
        .trim();
    const hit = await tavilySearchForSpec(steeredQuery, tavilyApiKey, family.officialDomains);
    if (hit) return { ...hit, board, subject, level };
  }

  const query = `${board} ${level || ""} ${subject} official specification syllabus content`.replace(/\s+/g, " ").trim();
  const hit = await tavilySearchForSpec(query, tavilyApiKey);
  return hit ? { ...hit, board, subject, level } : null;
}

export async function resolveOfficialSpec(
  messages: { role: string; content: string }[],
): Promise<ResolvedSpec | null> {
  await getAIConfig();
  const tavilyApiKey = await getTavilyKey();
  if (!tavilyApiKey) return null;

  const conversationText = messages.map((m) => m.content).join("\n");

  const run = async (): Promise<ResolvedSpec | null> => {
    const { board, subject, level } = await extractBoardSubjectLevel(messages);
    const family = detectExamFamily([conversationText, board, subject, level].filter(Boolean).join("\n"));
    const effectiveBoard = board || family?.boardFallback || null;
    const effectiveSubject = subject || family?.family || null;
    if (!effectiveBoard || !effectiveSubject) return null;
    return await searchOfficialSpec(effectiveBoard, effectiveSubject, level, tavilyApiKey, family);
  };

  const timeoutMs = detectExamFamily(conversationText) ? FAMILY_OVERALL_TIMEOUT_MS : OVERALL_TIMEOUT_MS;

  try {
    return await Promise.race([
      run(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (e) {
    console.error("resolveOfficialSpec failed:", e);
    return null;
  }
}
