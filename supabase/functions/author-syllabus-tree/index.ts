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
// GROUNDED: per-topic specification resolution. For each topic we fetch REAL spec text for that
// topic specifically and regenerate its subtopics from that text. Only this phase can produce a
// cacheable tree. It is slow (a search plus a model call per topic), so by default it runs in the
// background after the response is sent, exactly like chat/index.ts warms the lesson plan cache —
// the first student on a goal gets the fast tree, everyone after gets the grounded cached one.
//
// WHY PER-TOPIC. The first version of this function audited the whole tree against ONE ~6k-character
// search result. A real A-Level specification is a hundred pages, so that excerpt is ~1-2% of it —
// and an audit against it is structurally unable to catch the dominant failure, material missing
// from BOTH the tree and the excerpt. It rubber-stamped. specChecklistResolver.ts had already hit
// and documented this exact wall; specSearch.ts now holds the shared fix.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { resolveOfficialSpec } from "../_shared/specResolver.ts";
import { getTavilyKey, type SpecExcerpt, searchTopicSpecText } from "../_shared/specSearch.ts";
import {
  countSubtopics,
  hasCanonicalIdentity,
  MAX_SUBTOPICS_PER_TOPIC,
  MAX_TOPICS,
  MIN_GROUNDED_RATIO,
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
/** Grounding does a web search AND a model call per topic, so it is throttled harder. */
const GROUNDING_CONCURRENCY = 3;
/** Wall-clock budget for the whole grounding phase. Topics not reached are counted as ungrounded
 *  rather than silently dropped, so a timeout shows up honestly in topics_grounded. */
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

const SKELETON_SYSTEM = `You are a curriculum architect. Produce the COMPLETE, exhaustive list of top-level topics a student must master to fully achieve their goal — the ENTIRE syllabus, nothing left out. This must work for ANY mathematics or physics goal worldwide, high-school to undergraduate (JEE, STEP, A-level, IB, AP, a named university course, or a self-study aim).

Be exhaustive: a full multi-subject exam (e.g. JEE across Physics+Chemistry+Maths) legitimately needs 40-60 topics; a single-subject A-level 15-30; a focused module 6-12. Cover EVERY subject and area completely — never clip the last subject to save space. Order foundational → advanced. Topic TITLES ONLY, no subtopics.

GROUPING: prefer fewer, well-scoped topics over many narrow ones — group tightly-related concepts a student would naturally study together into ONE topic (e.g. "Quarks" and "Fundamental Particles" are facets of the same topic, not two). Only give something its own topic when the material is broad enough to need its own dedicated sequence of sessions. This is purely ORGANIZATIONAL, never a cut: every concept that belongs in the syllabus must still appear somewhere.

Return ONLY JSON: {"topics":["Topic 1","Topic 2", ...]}`;

const EXPAND_SYSTEM = `You are a curriculum editor. For EACH given topic, list its session-grain subtopics: each subtopic is ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting. Split anything broader. Spans all maths & physics, GCSE→undergraduate; judge grain relative to the goal's level. Order subtopics prerequisites-first. 3-${MAX_SUBTOPICS_PER_TOPIC} per topic. Keep each topic TITLE EXACTLY as given.

Good grain (one idea each): "Argand diagrams: plotting a complex number", "Resolving a projectile's velocity into components", "Gauss's law for a single point charge".
Too coarse (bundles many distinct ideas — must be split): "Complex Numbers", "Calculus", "Electromagnetism".

Return ONLY JSON: {"topics":[{"title":"<exact title>","subtopics":["...","..."]}]}`;

/**
 * The grounded pass. Expansion, audit and repair collapse into ONE call per topic, because with real
 * spec text in hand there is nothing to audit against separately — the subtopics are DERIVED from
 * the specification rather than invented and then checked against it.
 */
const GROUNDED_TOPIC_SYSTEM = `You are a curriculum editor working from a REAL official examination specification excerpt for ONE topic.

Produce the complete list of session-grain subtopics this topic requires, derived from the specification text you are given. Each subtopic is ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting.

Rules:
- COVER EVERYTHING in the excerpt that belongs to this topic. This is the whole point: anything the specification requires here and you omit is material the student will never be taught.
- Use the specification's OWN terminology and emphasis. Boards differ, and the excerpt is the authority.
- Keep any of the existing draft subtopics that genuinely fit, reworded to match the spec's terminology where they differ. Drop draft subtopics the specification does not actually require for this topic. Add everything it requires that is missing.
- SPLIT anything too broad for one sitting. A specification line item is frequently several sittings' worth of material and must not be copied across as a single subtopic.
- Order prerequisites-first. Return 3-${MAX_SUBTOPICS_PER_TOPIC} subtopics.
- The excerpt may be truncated mid-document, and may contain navigation text or material from OTHER topics. Ignore anything not about this topic. If the excerpt turns out to contain no real specification content for this topic at all, return {"subtopics": [], "grounded": false} and the draft will be kept as-is.

Return ONLY JSON: {"subtopics":["...","..."], "grounded": true}`;

// ---------------------------------------------------------------------------
// Phase 1 — fast, ungrounded
// ---------------------------------------------------------------------------

async function buildSkeleton(id: SyllabusIdentity, goal: string, spec: string): Promise<string[]> {
  const user = `${identityLine(id, goal)}${spec ? `\n\nOFFICIAL SPECIFICATION EXCERPT — base the topic list on this real content, in the terminology it uses. Do not invent top-level topics absent from it; use your own judgment only to fill gaps left by truncation:\n"""\n${spec}\n"""` : ""}\n\nProduce the exhaustive topic list now.`;
  const data = await askJson(SKELETON_SYSTEM, user);
  return cleanList(data?.topics, MAX_TOPICS);
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

async function buildFastTree(id: SyllabusIdentity, goal: string, wholeSpec: string): Promise<SyllabusTopic[] | null> {
  const skeleton = await buildSkeleton(id, goal, wholeSpec);
  if (skeleton.length < 3) return null;

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
  return topics;
}

// ---------------------------------------------------------------------------
// Phase 2 — grounded, per topic. The only phase that can produce a cacheable tree.
// ---------------------------------------------------------------------------

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

  const deadline = Date.now() + GROUNDING_BUDGET_MS;
  const ungrounded: string[] = [];
  let sourceUrl: string | undefined;

  const grounded = await pooled(draft, GROUNDING_CONCURRENCY, async (topic) => {
    if (Date.now() > deadline) {
      ungrounded.push(topic.title);
      return topic;
    }

    let excerpt: SpecExcerpt | null = null;
    try {
      excerpt = await searchTopicSpecText(
        id.board || "", id.subject || "", id.level || null, topic.title, tavilyKey,
      );
    } catch { /* fails soft below */ }

    if (!excerpt) {
      ungrounded.push(topic.title);
      return topic;
    }

    const user = `Topic: "${topic.title}"\nSubject: ${id.subject} | Level: ${id.level} | Board: ${id.board}\n\nEXISTING DRAFT SUBTOPICS:\n${JSON.stringify(topic.subtopics)}\n\nOFFICIAL SPECIFICATION EXCERPT (source: ${excerpt.sourceUrl}):\n"""\n${excerpt.text}\n"""\n\nProduce the complete session-grain subtopic list for this topic now.`;
    const data = await askJson(GROUNDED_TOPIC_SYSTEM, user);
    const subs = cleanList(data?.subtopics, MAX_SUBTOPICS_PER_TOPIC);

    // The model reporting `grounded: false`, or returning nothing usable, means the excerpt was not
    // really this topic's specification. Keeping the draft is right; claiming it was grounded is not.
    if (subs.length === 0 || data?.grounded === false) {
      ungrounded.push(topic.title);
      return topic;
    }

    sourceUrl ??= excerpt.sourceUrl;
    return { title: topic.title, subtopics: subs };
  });

  const groundedCount = total - ungrounded.length;
  const ratio = total > 0 ? groundedCount / total : 0;
  const verdict = ratio >= MIN_GROUNDED_RATIO && sourceUrl ? "grounded" : "unverified";

  const coverage: SyllabusCoverage = {
    verdict,
    topics_grounded: groundedCount,
    topics_total: total,
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    // Recorded as the honest gap in VERIFICATION, not in content: these topics still have subtopics,
    // they were just never checked against a specification. That distinction matters when reading a
    // cached tree later and deciding whether to trust it.
    ...(ungrounded.length ? { missing: ungrounded.slice(0, 25) } : {}),
  };

  console.log(`grounding: ${groundedCount}/${total} topics (${(ratio * 100).toFixed(0)}%) → ${verdict}`);
  return { topics: grounded, coverage };
}

/**
 * Write a grounded tree to the global cache. Separate from `groundTree` on purpose: the sync path
 * needs the grounded result in its response AND in the cache, and folding the write into the
 * grounding would mean grounding twice — every search and every model call, paid double.
 */
async function cacheTree(
  supabase: ReturnType<typeof createClient>,
  id: SyllabusIdentity,
  signature: string,
  topics: SyllabusTopic[],
  coverage: SyllabusCoverage,
): Promise<string | null> {
  try {
    if (coverage.verdict !== "grounded") {
      console.log("grounding insufficient — not caching");
      return null;
    }

    const validated = validateSyllabusTree({ topics, coverage });
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
          tree_version: SYLLABUS_TREE_VERSION,
          subject: id.subject,
          level: id.level,
          board: id.board,
          tree: validated.tree,
          coverage,
          model: ai.model,
        },
        // Must name BOTH columns: the unique constraint is (signature, tree_version); naming only
        // `signature` would match no constraint and turn the upsert into a failing insert.
        { onConflict: "signature,tree_version" },
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
  supabase: ReturnType<typeof createClient>,
  id: SyllabusIdentity,
  signature: string,
  draft: SyllabusTopic[],
): Promise<void> {
  try {
    const { topics, coverage } = await groundTree(id, draft);
    await cacheTree(supabase, id, signature, topics, coverage);
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
        .eq("tree_version", SYLLABUS_TREE_VERSION)
        .maybeSingle();
      if (error) console.error("syllabus_trees lookup failed (will author):", error);
      if (row?.tree) {
        const check = validateSyllabusTree(row.tree);
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

    const draft = await buildFastTree(identity, goal, wholeSpec?.text || "");
    if (!draft) {
      return json({ ok: false, errors: ["could not produce a usable syllabus for this goal"] });
    }

    // Grounding only ever runs for a cacheable identity: without a named board the per-topic search
    // has nothing to disambiguate on, and the result could not be cached even if it succeeded — so
    // running it would spend N searches to produce something we would then throw away.
    if (!supabase || !signature) {
      const fastTree = validateSyllabusTree({
        topics: draft,
        coverage: { verdict: "unverified", topics_grounded: 0, topics_total: draft.length },
      });
      if (!fastTree.ok) return json({ ok: false, errors: fastTree.errors });
      return json({ ok: true, cached: false, treeId: null, grounding: "skipped", tree: fastTree.tree });
    }

    if (syncGrounding) {
      const { topics, coverage } = await groundTree(identity, draft);
      const validated = validateSyllabusTree({ topics, coverage });
      if (!validated.ok) return json({ ok: false, errors: validated.errors });

      // Grounded ONCE, then written — cacheTree does no grounding of its own.
      const treeId = await cacheTree(supabase, identity, signature, topics, coverage);
      return json({ ok: true, cached: false, treeId, grounding: "sync", tree: validated.tree });
    }

    // Background grounding. The student's track is built from the fast tree; the grounded tree lands
    // in the cache for everyone after them. Same self-warming shape as the lesson plan cache.
    const work = groundAndCache(supabase, identity, signature, draft.map((t) => ({ ...t })));
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(work);
    } catch {
      /* not available in every runtime — the promise still runs while the isolate is warm */
    }

    const fastTree = validateSyllabusTree({
      topics: draft,
      coverage: { verdict: "unverified", topics_grounded: 0, topics_total: draft.length },
    });
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
