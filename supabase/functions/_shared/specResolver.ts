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
// Requires the TAVILY_API_KEY secret (https://tavily.com) to be added to the Supabase project.

type BoardSubjectLevel = { board: string | null; subject: string | null; level: string | null };

export type ResolvedSpec = {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  board: string;
  subject: string;
  level: string | null;
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OVERALL_TIMEOUT_MS = 15000;
// A recognised exam family runs up to two Tavily searches (steered, then generic), so it gets a
// slightly longer guard; the no-family path keeps the original budget.
const FAMILY_OVERALL_TIMEOUT_MS = 20000;
const MAX_EXCERPT_CHARS = 6000;
const MIN_USABLE_CHARS = 300;

// --- Exam-family search hints --------------------------------------------------------------------
// This is a table of SEARCH HINTS, not a registry of hardcoded spec content — extraction still goes
// through the same Tavily raw_content / HTML-fallback pipeline as every other board, and an
// unrecognised exam behaves exactly as before. Each entry says only: which official publisher's
// domains to constrain the first search to, what that body actually calls its syllabus document, and
// which awarding body to assume when the student named the exam but not the body (nobody prepping for
// "JEE Mains" ever says "NTA").
type ExamFamily = {
  family: string; // canonical exam name — used in the steered query, and as the subject fallback for whole-exam syllabi
  pattern: RegExp; // matched against the onboarding conversation + extracted board/subject/level
  officialDomains: string[]; // Tavily include_domains — the official publisher only (subdomains are covered by the parent)
  queryPhrase: string; // this body's own name for its specification document
  boardFallback: string; // awarding body to assume when the student didn't name one
};

// Order matters — first match wins: "JEE Advanced" before the bare "JEE" catch, and JEE/NEET before
// CBSE so "CBSE class 12, aiming for JEE" grounds in the JEE syllabus (the stated goal), not CBSE's.
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
    // Bare "JEE" / "IIT JEE" defaults to Main — the more common target; Advanced is matched above.
    pattern: /\b(?:iit[\s-]*)?jee\b/i,
    officialDomains: ["nta.ac.in", "nta.nic.in"], // jeemain.nta.nic.in is covered by the parent domain
    queryPhrase: "official syllabus",
    boardFallback: "NTA",
  },
  {
    family: "NEET",
    pattern: /\bneet\b/i,
    officialDomains: ["nta.ac.in", "nta.nic.in"], // neet.nta.nic.in is covered by the parent domain
    queryPhrase: "official syllabus",
    boardFallback: "NTA",
  },
  {
    family: "AP",
    pattern: /\badvanced placement\b|\bap\s+(?:calc(?:ulus)?|physics|chem(?:istry)?|bio(?:logy)?|stat(?:istics)?|precalc(?:ulus)?|computer science)\b/i,
    officialDomains: ["collegeboard.org"], // covers apcentral.collegeboard.org
    queryPhrase: "course and exam description course content", // College Board's name for the spec (the "CED")
    boardFallback: "College Board",
  },
  {
    family: "IB",
    pattern: /\binternational baccalaureate\b|\bib\s+(?:dp|diploma|math|maths|mathematics|physics|chem(?:istry)?|bio(?:logy)?)\b|\bmaths?\s+(?:aa|ai)\b|\banalysis (?:and|&) approaches\b|\bapplications (?:and|&) interpretation\b/i,
    officialDomains: ["ibo.org"],
    // Full IB guides sit behind the MyIB login; the public "subject brief" PDFs on ibo.org carry the
    // syllabus outline (components + topic list), which is what this phrasing surfaces.
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
    // Deliberately NOT case-insensitive on the bare acronym: lowercase "sat" is also just a common
    // English word ("I sat my mocks"), so lowercase only counts right next to an exam word.
    pattern: /\bSAT\b|\b[Dd]igital\s+[Ss][Aa][Tt]\b|\bsat\s+(?:math|exam|test|prep)\b/,
    officialDomains: ["collegeboard.org"], // covers satsuite.collegeboard.org
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

async function extractBoardSubjectLevel(
  messages: { role: string; content: string }[],
  lovableApiKey: string,
): Promise<BoardSubjectLevel> {
  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
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
      if (!contentType.includes("html")) return null; // don't attempt to read PDF/binary bytes as text
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

// One Tavily search + the usable-text scan over its results (raw_content first, own-fetch HTML
// fallback second). include_domains, when given, constrains results to those domains and their
// subdomains — used for the official-publisher steered attempt.
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
  // Steered attempt first for a recognised family: official publisher's domains + that body's own
  // document name. Domain-constrained search can also come back empty (indexing gaps on government
  // portals), so the generic attempt below always remains as the second try.
  if (family) {
    const steeredQuery =
      `${family.family} ${level || ""} ${subject === family.family ? "" : subject} ${family.queryPhrase}`
        .replace(/\s+/g, " ")
        .trim();
    const hit = await tavilySearchForSpec(steeredQuery, tavilyApiKey, family.officialDomains);
    if (hit) return { ...hit, board, subject, level };
  }

  // Generic attempt — the original behaviour, and the only attempt when no family matched.
  const query = `${board} ${level || ""} ${subject} official specification syllabus content`.replace(/\s+/g, " ").trim();
  const hit = await tavilySearchForSpec(query, tavilyApiKey);
  return hit ? { ...hit, board, subject, level } : null;
}

// Best-effort end to end: any failure or missing config returns null so callers can fall back cleanly.
export async function resolveOfficialSpec(
  messages: { role: string; content: string }[],
  lovableApiKey: string,
): Promise<ResolvedSpec | null> {
  const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyApiKey) return null;

  const conversationText = messages.map((m) => m.content).join("\n");

  const run = async (): Promise<ResolvedSpec | null> => {
    const { board, subject, level } = await extractBoardSubjectLevel(messages, lovableApiKey);
    // Detect against the conversation AND the extracted fields, so "AP Calculus BC" still registers
    // when the student only typed "calc BC" and the extraction step filled in the rest — and so the
    // big entrance exams resolve even when extraction failed outright.
    const family = detectExamFamily([conversationText, board, subject, level].filter(Boolean).join("\n"));
    // Family hints fill the two gaps that used to kill non-UK resolution: no named awarding body
    // ("preparing for JEE Mains" — board null), and whole-exam syllabi (JEE/NEET/SAT cover all their
    // subjects in one official document, so a missing subject shouldn't bail either). With no family
    // matched, the null checks below behave exactly as before.
    const effectiveBoard = board || family?.boardFallback || null;
    const effectiveSubject = subject || family?.family || null;
    if (!effectiveBoard || !effectiveSubject) return null;
    return await searchOfficialSpec(effectiveBoard, effectiveSubject, level, tavilyApiKey, family);
  };

  // Timeout is picked off the conversation alone (extraction hasn't run yet out here) — a family only
  // detectable from extracted fields just keeps the original budget, worst case cut to null as ever.
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
