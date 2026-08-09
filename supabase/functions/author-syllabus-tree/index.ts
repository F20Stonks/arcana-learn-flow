// author-syllabus-tree — builds the topic/subtopic decomposition for a learning goal, and caches it
// globally when the goal names a real external syllabus. See docs/syllabus-tree-layer.md.
//
// This function REPLACES the multi-pass track builder that used to run in the browser
// (`buildFullTrack` / `refineTrackGrain` in OnboardingPage.tsx). Moving it here is not tidying:
//   1. the cache write MUST be service-role. If a client could write the cache, any user could
//      replace the syllabus served to every future student on that goal;
//   2. the authoring prompts stop shipping to the browser;
//   3. one code path now serves both cached and bespoke goals — the only difference is whether the
//      result is written to the cache at the end.
//
// TWO PHASES, AND THE SECOND ONE IS THE POINT.
//
// FAST: a skeleton pass plus an ungrounded expansion. Returns in seconds. This is what the waiting
// student's track is built from, and it is NEVER cached — it has been checked against nothing.
//
// GROUNDED: resolve the ONE document that IS this syllabus's specification — usually a PDF — read it
// in FULL, split it into overlapping chunks, and regenerate every topic's subtopics from the chunks
// that actually contain its content. Only this phase can produce a cacheable tree. It is slow (a
// document fetch/parse plus a handful of model calls), so by default it runs in the background after
// the response is sent, exactly like chat/index.ts warms the lesson plan cache — the first student on
// a goal gets the fast tree, everyone after gets the grounded cached one.
//
// TWO THINGS WERE WRONG WITH THE FIRST VERSION OF THIS PHASE, NOT ONE.
//
// (1) It audited the whole tree against ONE ~6k-character search result — roughly 1-2% of a real
// hundred-page specification — so the audit was structurally unable to catch the dominant failure,
// material missing from BOTH the tree and the excerpt. It rubber-stamped.
//
// (2) The obvious fix — search per topic instead — was ALSO broken, for a reason that had nothing to
// do with granularity: the fetch fallback only accepted `content-type: html` and silently discarded
// every PDF result, and specifications are very frequently published as PDFs. So even a correctly
// targeted per-topic search would often find the real document and then throw it away unread.
//
// The fix here is neither "audit less" nor "search narrower" — it is "read the actual document,
// whatever format it's in, wherever it's actually hosted." specSearch.ts's `resolveSpecDocument` does
// not restrict by domain: a specification mirrored on a revision site or a school's own upload is
// exactly as usable as the exam board's own copy, and is often the only copy a search surfaces well.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { resolveOfficialSpec } from "../_shared/specResolver.ts";
import { chunkText, getTavilyKey, resolveSpecDocument } from "../_shared/specSearch.ts";
import {
  countSubtopics,
  hasCanonicalIdentity,
  MAX_SUBTOPICS_PER_TOPIC,
  MAX_TOPICS,
  MIN_GROUNDED_RATIO,
  MIN_OPTION_TOPICS,
  MIN_TOPICS,
  type SyllabusCoverage,
  type SyllabusIdentity,
  type SyllabusTopic,
  SYLLABUS_TREE_VERSION,
  treeSignature,
  validateSyllabusTree,
} from "../_shared/syllabusTree.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** How many topics go into one FAST expansion call. Small batches keep each response inside the
 *  token budget — the reason single-shot generation used to truncate large syllabuses. */
const EXPAND_BATCH_SIZE = 4;
/** Cap on concurrent model calls. Firing 15 batches at once reliably trips gateway rate limits. */
const EXPAND_CONCURRENCY = 5;
/** Characters per grounding chunk. Large enough that a real specification (60-150k chars) needs only
 *  a handful of chunks, small enough to stay comfortably inside one model call's context+response
 *  budget alongside the full topic list sent with every chunk. */
const CHUNK_CHARS = 25_000;
/** A specification's content statements are frequently split across a source-document page boundary.
 *  Without overlap, a topic whose defining sentence straddles a chunk boundary appears in neither
 *  chunk's context and never grounds. */
const CHUNK_OVERLAP_CHARS = 1_000;
/** Cap on concurrent chunk calls. Far fewer chunks than the old per-topic call count, so this can
 *  stay modest without the whole phase taking materially longer. */
const CHUNK_CONCURRENCY = 4;
/** Wall-clock budget for the whole grounding phase. Chunks not reached before the deadline are
 *  skipped rather than silently dropped from the count, so a timeout shows up honestly as a lower
 *  topics_grounded ratio instead of quietly passing. */
const GROUNDING_BUDGET_MS = 110_000;

// ---------------------------------------------------------------------------
// Model plumbing
// ---------------------------------------------------------------------------

function parseJsonLoose(content: string): any | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : content).trim();
  try {
    return JSON.parse(body);
  } catch { /* fall through to brace extraction */ }
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(body.slice(first, last + 1));
    } catch { /* genuinely unparseable */ }
  }
  return null;
}

/** One non-streaming JSON completion. Null on any failure; every caller has a defined fallback. */
async function askJson(system: string, user: string): Promise<any | null> {
  try {
    const ai = await getAIConfig("authoring");
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("syllabus authoring AI error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return parseJsonLoose(data.choices?.[0]?.message?.content || "");
  } catch (e) {
    console.error("syllabus authoring call failed:", e);
    return null;
  }
}

/** Bounded-concurrency map that preserves input order. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const cleanList = (v: unknown, cap: number): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of v) {
    const t = String(s ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const identityLine = (id: SyllabusIdentity, goal: string) =>
  `Goal: "${goal}"\nSubject: ${id.subject || "(unspecified)"} | Level: ${id.level || "(unspecified)"} | Exam/Board: ${id.board || "(none named)"}`;

/**
 * Two skeleton modes, not one. Real specs are frequently not a single linear list: AQA A-Level
 * Physics has a compulsory core PLUS five mutually-exclusive OPTIONS (Astrophysics, Medical Physics,
 * Engineering Physics, Turning Points in Physics, Electronics) of which a student sits exactly one.
 * The original single-mode prompt had no concept of this at all — pointed at a spec with options, it
 * would either fold all of them in (wrong: hands every student 4 options' worth of material they'll
 * never sit) or silently pick one (wrong: which one is not this prompt's call to make). CORE mode
 * builds ONLY the compulsory content and separately names whatever electives it's aware of, so the
 * caller (onboarding / TrackOverview) can offer a picker; OPTION mode builds ONLY the one named
 * elective, scoped as a small module rather than judged against whole-syllabus expectations.
 */
function buildSkeletonSystem(option: string): string {
  if (!option) {
    return `You are a curriculum architect. Produce the COMPLETE, exhaustive list of top-level topics for the COMPULSORY, CORE part of a student's goal — the material EVERY student pursuing this goal must cover, regardless of any elective/optional units they separately choose. This must work for ANY mathematics or physics goal worldwide, high-school to undergraduate (JEE, STEP, A-level, IB, AP, a named university course, or a self-study aim).

Be exhaustive: a full multi-subject exam (e.g. JEE across Physics+Chemistry+Maths) legitimately needs 40-60 topics; a single-subject A-level 15-30; a focused module 6-12. Cover EVERY subject and area completely — never clip the last subject to save space. Order foundational → advanced. Topic TITLES ONLY, no subtopics.

GROUPING: prefer fewer, well-scoped topics over many narrow ones — group tightly-related concepts a student would naturally study together into ONE topic (e.g. "Quarks" and "Fundamental Particles" are facets of the same topic, not two). Only give something its own topic when the material is broad enough to need its own dedicated sequence of sessions. This is purely ORGANIZATIONAL, never a cut: every concept that belongs in the CORE syllabus must still appear somewhere.

ELECTIVE/OPTIONAL UNITS: many syllabuses (especially A-Level style exams) offer a small set of mutually-exclusive OPTION units of which a student studies only one, or a subset, chosen separately from the compulsory core (e.g. AQA A-Level Physics's Astrophysics/Medical Physics/Engineering Physics/Turning Points in Physics/Electronics — a student sits exactly one). EXCLUDE all such elective content from the topic list above. Instead, separately report the names of whatever elective/optional units you know this syllabus offers, in "optionalUnits" — empty array if this syllabus has none, or if you're not sure. Do not guess unit names that aren't real.

Return ONLY JSON: {"topics":["Topic 1","Topic 2", ...], "optionalUnits":["Option A","Option B", ...]}`;
  }

  return `You are a curriculum architect authoring ONE ELECTIVE OPTION UNIT within a larger syllabus — NOT the whole syllabus. The student separately covers (or has covered) the compulsory core; your job is only the topic list for the single named option: "${option}".

This is normally a small, focused unit — commonly 2-6 topics, occasionally fewer for a narrow option. Do NOT pad it to resemble a full syllabus, and do NOT include material that belongs to the compulsory core or to a DIFFERENT option. Order foundational → advanced. Topic TITLES ONLY, no subtopics.

GROUPING: prefer fewer, well-scoped topics over many narrow ones, same reasoning as for a full syllabus — group tightly-related concepts a student would naturally study together into ONE topic.

Return ONLY JSON: {"topics":["Topic 1","Topic 2", ...]}`;
}

const EXPAND_SYSTEM = `You are a curriculum editor. For EACH given topic, list its session-grain subtopics: each subtopic is ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting. Split anything broader. Spans all maths & physics, GCSE→undergraduate; judge grain relative to the goal's level. Order subtopics prerequisites-first. 3-${MAX_SUBTOPICS_PER_TOPIC} per topic. Keep each topic TITLE EXACTLY as given.

Good grain (one idea each): "Argand diagrams: plotting a complex number", "Resolving a projectile's velocity into components", "Gauss's law for a single point charge".
Too coarse (bundles many distinct ideas — must be split): "Complex Numbers", "Calculus", "Electromagnetism".

Return ONLY JSON: {"topics":[{"title":"<exact title>","subtopics":["...","..."]}]}`;

/**
 * The grounded pass. Expansion, audit and repair collapse into ONE call per CHUNK, because with real
 * spec text in hand there is nothing to audit separately — the subtopics are DERIVED from the
 * specification rather than invented and then checked against it. One chunk is one physical slice of
 * the real document (see chunkText in specSearch.ts), not one topic — a chunk may cover several
 * topics, one topic, or none, and the model is told to report exactly that rather than guess.
 */
const GROUNDED_CHUNK_SYSTEM = `You are extracting curriculum structure from ONE CHUNK of a real official examination specification document. The chunk is a mechanical slice of a much larger document — it may start or end mid-sentence, may be a title page or table of contents with no real content, and will very often cover only SOME of the topics you are given, or none at all. That is expected; only report what is actually IN this chunk.

You are given the syllabus's full topic list (with draft subtopics from an earlier, ungrounded pass) and this one chunk of real specification text.

For EACH topic this chunk contains real specification content for:
- Produce the complete session-grain subtopic list for that topic, AS FAR AS THIS CHUNK COVERS IT. (A different chunk may cover the rest of the same topic if its content spans multiple pages of the source document — you are only reporting this chunk's share.)
- Each subtopic is ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting. Split anything the specification bundles that is broader than one sitting.
- Use the specification's own terminology, not the draft's.
- The topic title in your response must match one of the given titles EXACTLY.

Do NOT include a topic you have no real content for in this chunk — do not guess, do not pad from the draft, do not invent. An empty result for a chunk that turns out to be front matter or an appendix is the CORRECT answer, not a failure.

Return ONLY JSON: {"topics": [{"title": "<exact title from the list>", "subtopics": ["...", "..."]}]}
If this chunk has no real specification content for any of the given topics, return {"topics": []}.`;

// ---------------------------------------------------------------------------
// Phase 1 — fast, ungrounded
// ---------------------------------------------------------------------------

async function buildSkeleton(
  id: SyllabusIdentity,
  goal: string,
  spec: string,
  option: string,
): Promise<{ topics: string[]; optionalUnits: string[] }> {
  const scopeLine = option ? `\n\nYou are scoped to ONE elective option: "${option}". Ignore any other options or the compulsory core.` : "";
  const user = `${identityLine(id, goal)}${scopeLine}${spec ? `\n\nOFFICIAL SPECIFICATION EXCERPT — base the topic list on this real content, in the terminology it uses. Do not invent top-level topics absent from it; use your own judgment only to fill gaps left by truncation:\n"""\n${spec}\n"""` : ""}\n\nProduce the exhaustive topic list now.`;
  const data = await askJson(buildSkeletonSystem(option), user);
  return {
    topics: cleanList(data?.topics, MAX_TOPICS),
    // Only meaningful in core mode — an option-mode call has nothing further to name, and its prompt
    // never asks for this field, so `data?.optionalUnits` will simply be absent/empty there.
    optionalUnits: option ? [] : cleanList(data?.optionalUnits, MAX_TOPICS),
  };
}

async function expandTopics(id: SyllabusIdentity, goal: string, titles: string[]): Promise<Record<string, string[]>> {
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += EXPAND_BATCH_SIZE) batches.push(titles.slice(i, i + EXPAND_BATCH_SIZE));

  const maps = await pooled(batches, EXPAND_CONCURRENCY, async (batch) => {
    const user = `${identityLine(id, goal)}\n\nTopics: ${JSON.stringify(batch)}\n\nExpand these into session-grain subtopics.`;
    const data = await askJson(EXPAND_SYSTEM, user);
    const out: Record<string, string[]> = {};
    if (Array.isArray(data?.topics)) {
      for (const t of data.topics) {
        const title = String(t?.title ?? "").trim();
        const subs = cleanList(t?.subtopics, MAX_SUBTOPICS_PER_TOPIC);
        if (title && subs.length) out[title] = subs;
      }
    }
    return out;
  });

  return Object.assign({}, ...maps);
}

/**
 * Match an expansion back to the skeleton title it was asked about. The model is told to echo titles
 * verbatim and usually does, but a stray "The " silently orphans a whole topic.
 */
function lookupExpansion(map: Record<string, string[]>, title: string): string[] | null {
  if (map[title]) return map[title];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(title);
  for (const [k, v] of Object.entries(map)) {
    if (norm(k) === target) return v;
  }
  return null;
}

async function buildFastTree(
  id: SyllabusIdentity,
  goal: string,
  wholeSpec: string,
  option: string,
): Promise<{ topics: SyllabusTopic[]; optionalUnits: string[] } | null> {
  const { topics: skeleton, optionalUnits } = await buildSkeleton(id, goal, wholeSpec, option);
  // Option mode is authoring one small elective unit, not a whole syllabus — MIN_TOPICS (the
  // whole-syllabus floor, catching a broken skeleton call) would wrongly reject a legitimately small
  // 1-2 topic option. See MIN_OPTION_TOPICS in syllabusTree.ts.
  const floor = option ? MIN_OPTION_TOPICS : MIN_TOPICS;
  if (skeleton.length < floor) return null;

  const expansions = await expandTopics(id, goal, skeleton);
  const topics: SyllabusTopic[] = [];
  for (const title of skeleton) {
    const subs = lookupExpansion(expansions, title);
    // A topic that failed to expand is DROPPED, not padded with its own title as a lone subtopic.
    // The old client path padded, producing tracks whose sections looked complete but opened one
    // unteachable mega-session each. A visibly shorter track is the honest failure.
    if (subs && subs.length) topics.push({ title, subtopics: subs });
  }
  if (topics.length < Math.ceil(skeleton.length * 0.6)) {
    console.error(`only ${topics.length}/${skeleton.length} topics expanded`);
    return null;
  }
  return { topics, optionalUnits };
}

// ---------------------------------------------------------------------------
// Phase 2 — grounded, against the real document. The only phase that can produce a cacheable tree.
// ---------------------------------------------------------------------------

/** The compact form of the draft tree sent alongside EVERY chunk, so the model can match content to
 *  exact topic titles without re-deriving the syllabus structure from scratch each time. */
function draftTopicList(draft: SyllabusTopic[]): string {
  return draft.map((t) => `- ${t.title} :: ${t.subtopics.join("; ")}`).join("\n");
}

async function groundTree(
  id: SyllabusIdentity,
  draft: SyllabusTopic[],
): Promise<{ topics: SyllabusTopic[]; coverage: SyllabusCoverage }> {
  const total = draft.length;
  const tavilyKey = await getTavilyKey();
  if (!tavilyKey) {
    console.error("no TAVILY_API_KEY — cannot ground, tree will not be cached");
    return { topics: draft, coverage: { verdict: "unverified", topics_grounded: 0, topics_total: total } };
  }

  const doc = await resolveSpecDocument(
    id.board || "", id.subject || "", id.level || null, tavilyKey, draft.map((t) => t.title),
  ).catch((e) => {
    console.error("spec document resolution failed:", e);
    return null;
  });
  if (!doc) {
    console.error("no specification document could be resolved — tree will not be cached");
    return { topics: draft, coverage: { verdict: "unverified", topics_grounded: 0, topics_total: total } };
  }

  const chunks = chunkText(doc.text, CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
  const topicList = draftTopicList(draft);
  const deadline = Date.now() + GROUNDING_BUDGET_MS;

  // Accumulate subtopics found per topic ACROSS chunks (overlap, or a section genuinely spanning
  // multiple chunks, can mean the same topic is reported more than once) — merged and deduped below.
  const foundByTopic = new Map<string, string[]>();

  await pooled(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    if (Date.now() > deadline) return;
    const user = `SYLLABUS TOPICS (draft, for matching only — the specification chunk is the authority):\n${topicList}\n\nSPECIFICATION CHUNK (source: ${doc.sourceUrl}):\n"""\n${chunk}\n"""\n\nExtract what this chunk covers now.`;
    const data = await askJson(GROUNDED_CHUNK_SYSTEM, user);
    if (!Array.isArray(data?.topics)) return;
    for (const t of data.topics) {
      const title = String(t?.title ?? "").trim();
      const subs = cleanList(t?.subtopics, MAX_SUBTOPICS_PER_TOPIC);
      if (!title || subs.length === 0) continue;
      const key = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = foundByTopic.get(key) || [];
      foundByTopic.set(key, [...existing, ...subs]);
    }
  });

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let groundedCount = 0;
  const ungrounded: string[] = [];
  const topics: SyllabusTopic[] = draft.map((topic) => {
    const merged = foundByTopic.get(norm(topic.title));
    if (!merged || merged.length === 0) {
      ungrounded.push(topic.title);
      return topic;
    }
    groundedCount++;
    return { title: topic.title, subtopics: cleanList(merged, MAX_SUBTOPICS_PER_TOPIC) };
  });

  const ratio = total > 0 ? groundedCount / total : 0;
  const verdict = ratio >= MIN_GROUNDED_RATIO ? "grounded" : "unverified";

  const coverage: SyllabusCoverage = {
    verdict,
    topics_grounded: groundedCount,
    topics_total: total,
    source_url: doc.sourceUrl,
    // Recorded as the honest gap in VERIFICATION, not in content: these topics still have subtopics,
    // they were just never matched to real specification text in the resolved document. That
    // distinction matters when reading a cached tree later and deciding whether to trust it.
    ...(ungrounded.length ? { missing: ungrounded.slice(0, 25) } : {}),
  };

  console.log(
    `grounding: resolved ${doc.text.length} chars from ${doc.sourceUrl} as ${chunks.length} chunk(s); ` +
    `${groundedCount}/${total} topics (${(ratio * 100).toFixed(0)}%) → ${verdict}`,
  );
  return { topics, coverage };
}

/**
 * Write a grounded tree to the global cache. Separate from `groundTree` on purpose: the sync path
 * needs the grounded result in its response AND in the cache, and folding the write into the
 * grounding would mean grounding twice — every search and every model call, paid double.
 */
async function cacheTree(
  // deno-lint-ignore no-explicit-any
  supabase: any, // `ReturnType<typeof createClient>` resolves to the GENERIC function's default type
  // params (schema "never"), not the concrete client `createClient(url, key, opts)` actually returns
  // — passing that concrete client to a parameter typed that way fails to typecheck. No other function
  // in this codebase hits this because none of them factor the client out into a helper; `any` here is
  // the same looseness the rest of this file already uses for AI response shapes.
  id: SyllabusIdentity,
  signature: string,
  option: string,
  topics: SyllabusTopic[],
  coverage: SyllabusCoverage,
  optionalUnits: string[],
): Promise<string | null> {
  try {
    if (coverage.verdict !== "grounded") {
      console.log("grounding insufficient — not caching");
      return null;
    }

    // Option mode uses the same MIN_OPTION_TOPICS floor as buildFastTree — a legitimately small
    // elective unit must not fail cache-write validation for the same reason it doesn't fail the
    // fast-build check.
    const validated = validateSyllabusTree(
      { topics, coverage, ...(optionalUnits.length ? { optionalUnits } : {}) },
      option ? MIN_OPTION_TOPICS : MIN_TOPICS,
    );
    if (!validated.ok) {
      console.error("grounded tree failed validation, not caching:", validated.errors.join("; "));
      return null;
    }

    const ai = await getAIConfig("authoring");
    const { data: written, error } = await supabase
      .from("syllabus_trees")
      .upsert(
        {
          signature,
          option,
          tree_version: SYLLABUS_TREE_VERSION,
          subject: id.subject,
          level: id.level,
          board: id.board,
          tree: validated.tree,
          coverage,
          model: ai.model,
        },
        // Must name ALL THREE columns: the unique constraint is (signature, option, tree_version);
        // naming fewer would match no constraint and turn the upsert into a failing insert.
        { onConflict: "signature,option,tree_version" },
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("syllabus_trees upsert failed:", error);
      return null;
    }
    console.log(
      `cached grounded syllabus: ${validated.tree.topics.length} topics / ` +
      `${countSubtopics(validated.tree)} subtopics, ${coverage.topics_grounded}/${coverage.topics_total} grounded`,
    );
    return (written?.id as string) ?? null;
  } catch (e) {
    console.error("cacheTree failed:", e);
    return null;
  }
}

/** Ground, then cache. The background path; returns nothing because nobody is waiting on it. */
async function groundAndCache(
  // deno-lint-ignore no-explicit-any
  supabase: any, // see the comment on cacheTree's identical parameter above
  id: SyllabusIdentity,
  signature: string,
  option: string,
  draft: SyllabusTopic[],
  optionalUnits: string[],
): Promise<void> {
  try {
    const { topics, coverage } = await groundTree(id, draft);
    await cacheTree(supabase, id, signature, option, topics, coverage, optionalUnits);
  } catch (e) {
    console.error("background grounding failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const callerId = await requireUser(req);
  if (!callerId) return unauthorized(corsHeaders);

  try {
    const body = await req.json();
    const identity: SyllabusIdentity = {
      subject: body?.subject ?? null,
      level: body?.level ?? null,
      board: body?.board ?? null,
    };
    // '' (default) = the compulsory core. A specific option name authors just that one elective unit.
    // See buildSkeletonSystem's two modes above and 20260809130000_syllabus_tree_options.sql.
    const option: string = String(body?.option ?? "").trim();
    const goal: string = String(body?.goal ?? "").trim() || [identity.level, identity.subject].filter(Boolean).join(" ");
    // `sync` forces grounding to run inline instead of after the response. Onboarding never uses it
    // (a student cannot wait two minutes); the breadth sweep does, because a background phase it
    // cannot observe is a phase it cannot verify.
    const syncGrounding = body?.mode === "sync";

    const messages: { role: string; content: string }[] = Array.isArray(body?.messages) && body.messages.length
      ? body.messages
      : [{ role: "user", content: [goal, identity.board, identity.subject, identity.level].filter(Boolean).join(" ") }];

    if (!goal) return json({ ok: false, errors: ["a goal, or a subject and level, is required"] }, 400);

    const canonical = hasCanonicalIdentity(identity);
    const signature = canonical ? await treeSignature(identity) : null;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;

    // --- Cache hit: the whole point of the layer. No AI call, no search, instant onboarding. ---
    if (supabase && signature) {
      const { data: row, error } = await supabase
        .from("syllabus_trees")
        .select("id, tree, coverage")
        .eq("signature", signature)
        .eq("option", option)
        .eq("tree_version", SYLLABUS_TREE_VERSION)
        .maybeSingle();
      if (error) console.error("syllabus_trees lookup failed (will author):", error);
      if (row?.tree) {
        const check = validateSyllabusTree(row.tree, option ? MIN_OPTION_TOPICS : MIN_TOPICS);
        if (check.ok) {
          return json({
            ok: true,
            cached: true,
            treeId: row.id,
            tree: { ...check.tree, coverage: (row.coverage as SyllabusCoverage) ?? check.tree.coverage },
          });
        }
        console.error("cached syllabus tree failed validation, re-authoring:", check.errors.join("; "));
      }
    }

    // --- Miss: fast tree first, so the student is never waiting on the grounded pass. ---
    const wholeSpec = await resolveOfficialSpec(messages).catch((e) => {
      console.error("spec resolution failed:", e);
      return null;
    });

    const built = await buildFastTree(identity, goal, wholeSpec?.text || "", option);
    if (!built) {
      return json({ ok: false, errors: ["could not produce a usable syllabus for this goal"] });
    }
    const { topics: draft, optionalUnits } = built;
    const minTopics = option ? MIN_OPTION_TOPICS : MIN_TOPICS;

    // Grounding only ever runs for a cacheable identity: without a named board the per-topic search
    // has nothing to disambiguate on, and the result could not be cached even if it succeeded — so
    // running it would spend N searches to produce something we would then throw away.
    if (!supabase || !signature) {
      const fastTree = validateSyllabusTree({
        topics: draft,
        coverage: { verdict: "unverified", topics_grounded: 0, topics_total: draft.length },
        ...(optionalUnits.length ? { optionalUnits } : {}),
      }, minTopics);
      if (!fastTree.ok) return json({ ok: false, errors: fastTree.errors });
      return json({ ok: true, cached: false, treeId: null, grounding: "skipped", tree: fastTree.tree });
    }

    if (syncGrounding) {
      const { topics, coverage } = await groundTree(identity, draft);
      const validated = validateSyllabusTree(
        { topics, coverage, ...(optionalUnits.length ? { optionalUnits } : {}) },
        minTopics,
      );
      if (!validated.ok) return json({ ok: false, errors: validated.errors });

      // Grounded ONCE, then written — cacheTree does no grounding of its own.
      const treeId = await cacheTree(supabase, identity, signature, option, topics, coverage, optionalUnits);
      return json({ ok: true, cached: false, treeId, grounding: "sync", tree: validated.tree });
    }

    // Background grounding. The student's track is built from the fast tree; the grounded tree lands
    // in the cache for everyone after them. Same self-warming shape as the lesson plan cache.
    const work = groundAndCache(supabase, identity, signature, option, draft.map((t) => ({ ...t })), optionalUnits);
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(work);
    } catch {
      /* not available in every runtime — the promise still runs while the isolate is warm */
    }

    const fastTree = validateSyllabusTree({
      topics: draft,
      coverage: { verdict: "unverified", topics_grounded: 0, topics_total: draft.length },
      ...(optionalUnits.length ? { optionalUnits } : {}),
    }, minTopics);
    if (!fastTree.ok) return json({ ok: false, errors: fastTree.errors });

    console.log(
      `fast syllabus returned: ${fastTree.tree.topics.length} topics / ${countSubtopics(fastTree.tree)} subtopics; ` +
      `grounding queued for signature ${signature.slice(0, 12)}…`,
    );
    return json({ ok: true, cached: false, treeId: null, grounding: "queued", tree: fastTree.tree });
  } catch (e) {
    console.error("author-syllabus-tree error:", e);
    return json({ ok: false, errors: [e instanceof Error ? e.message : "unknown error"] }, 500);
  }
});
