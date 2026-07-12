// Query-time framework for grounding track generation in a real official exam specification,
// for arbitrary exam boards/subjects/levels — no hardcoded per-board registry.
//
// Pipeline:
//   1. extractBoardSubjectLevel — small LLM call, pulls {board, subject, level} out of the free-text
//      onboarding conversation (works for any board the student names, not a fixed list).
//   2. searchOfficialSpec — Tavily web search for that board+subject+level's official specification.
//      Tavily extracts readable text server-side per result (`raw_content`), including from PDFs, so
//      this avoids parsing PDFs inside the Deno edge runtime — unpdf, the only real option there, has
//      a documented unresolved failure in Supabase Edge Functions specifically:
//      https://github.com/unjs/unpdf/issues/3
//   3. A lightweight own-fetch HTML fallback if Tavily didn't return usable raw_content for an
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
const MAX_EXCERPT_CHARS = 6000;
const MIN_USABLE_CHARS = 300;

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

async function searchOfficialSpec(
  board: string,
  subject: string,
  level: string | null,
  tavilyApiKey: string,
): Promise<ResolvedSpec | null> {
  const query = `${board} ${level || ""} ${subject} official specification syllabus content`.replace(/\s+/g, " ").trim();

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${tavilyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: "advanced",
      include_raw_content: true,
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
      return {
        text: text.slice(0, MAX_EXCERPT_CHARS),
        sourceUrl: r.url,
        sourceTitle: r.title,
        board,
        subject,
        level,
      };
    }
  }

  return null;
}

// Best-effort end to end: any failure or missing config returns null so callers can fall back cleanly.
export async function resolveOfficialSpec(
  messages: { role: string; content: string }[],
  lovableApiKey: string,
): Promise<ResolvedSpec | null> {
  const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyApiKey) return null;

  const run = async (): Promise<ResolvedSpec | null> => {
    const { board, subject, level } = await extractBoardSubjectLevel(messages, lovableApiKey);
    if (!board || !subject) return null;
    return await searchOfficialSpec(board, subject, level, tavilyApiKey);
  };

  try {
    return await Promise.race([
      run(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), OVERALL_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error("resolveOfficialSpec failed:", e);
    return null;
  }
}
