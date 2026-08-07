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
// DIFFERENCE FROM author-lesson-plan: that function fails CLOSED when the cache is unavailable,
// because a plan-less session is merely today's behaviour. This one must never fail closed — the
// student is waiting on a track and has no product at all without one. An uncacheable tree is still
// returned and used; it is simply not shared.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { resolveOfficialSpec } from "../_shared/specResolver.ts";
import {
  countSubtopics,
  hasCanonicalIdentity,
  MAX_SUBTOPICS_PER_TOPIC,
  MAX_TOPICS,
  type SyllabusCoverage,
  type SyllabusIdentity,
  type SyllabusTopic,
  type SyllabusTree,
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

/** How many topics go into one expansion call. Small batches keep each response well inside the
 *  token budget — the whole reason the old single-shot generation truncated large syllabuses. */
const EXPAND_BATCH_SIZE = 4;
/** Cap on concurrent expansion calls. A 60-topic syllabus is 15 batches; firing all of them at once
 *  reliably trips gateway rate limits, and a 429 mid-build loses the whole tree. */
const EXPAND_CONCURRENCY = 5;

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

/**
 * One non-streaming JSON completion. Returns null on any failure — every caller here has a defined
 * fallback, and a partial tree must never be mistaken for a complete one.
 */
async function askJson(
  system: string,
  user: string,
  tier: "turn" | "authoring" = "authoring",
): Promise<any | null> {
  try {
    const ai = await getAIConfig(tier);
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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

/** Run tasks with a bounded concurrency pool, preserving input order in the result. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const identityLine = (id: SyllabusIdentity, goal: string) =>
  `Goal: "${goal}"\nSubject: ${id.subject || "(unspecified)"} | Level: ${id.level || "(unspecified)"} | Exam/Board: ${id.board || "(none named)"}`;

const SKELETON_SYSTEM = `You are a curriculum architect. Produce the COMPLETE, exhaustive list of top-level topics a student must master to fully achieve their goal — the ENTIRE syllabus, nothing left out. This must work for ANY mathematics or physics goal worldwide, high-school to undergraduate (JEE, STEP, A-level, IB, AP, a named university course, or a self-study aim).

Be exhaustive: a full multi-subject exam (e.g. JEE across Physics+Chemistry+Maths) legitimately needs 40-60 topics; a single-subject A-level 15-30; a focused module 6-12. Cover EVERY subject and area completely — never clip the last subject to save space. Order foundational → advanced. Topic TITLES ONLY, no subtopics.

GROUPING: prefer fewer, well-scoped topics over many narrow ones — group tightly-related concepts a student would naturally study together into ONE topic (e.g. "Quarks" and "Fundamental Particles" are facets of the same topic, not two; "Newton's Laws" and "Forces" likewise). Only give something its own topic when the material is broad enough to need its own dedicated sequence of sessions. This is purely ORGANIZATIONAL, never a cut: every concept that belongs in the syllabus must still appear somewhere in the final list — grouping changes which topic it is filed under, never whether it is covered.

Return ONLY JSON: {"topics":["Topic 1","Topic 2", ...]}`;

const EXPAND_SYSTEM = `You are a curriculum editor. For EACH given topic, list its session-grain subtopics: each subtopic is ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting. Split anything broader. Spans all maths & physics, GCSE→undergraduate; judge grain relative to the goal's level. Order subtopics prerequisites-first. 3-${MAX_SUBTOPICS_PER_TOPIC} per topic. Keep each topic TITLE EXACTLY as given.

Good grain (one idea each): "Argand diagrams: plotting a complex number", "Resolving a projectile's velocity into components", "Gauss's law for a single point charge".
Too coarse (bundles many distinct ideas — must be split): "Complex Numbers", "Calculus", "Electromagnetism".

Return ONLY JSON: {"topics":[{"title":"<exact title>","subtopics":["...","..."]}]}`;

const AUDIT_SYSTEM = `You are auditing a generated syllabus against the OFFICIAL specification excerpt for coverage. Your ONE job is to find what the specification requires that the syllabus does NOT cover anywhere.

Rules:
- Judge by MEANING, not wording. A spec area is covered if any topic or subtopic plainly teaches it, under any reasonable name.
- Report ONLY genuine, substantive gaps — a whole spec area with no home in the syllabus. Do NOT report phrasing differences, granularity preferences, or ordering.
- The excerpt may be truncated mid-document. Judge ONLY against what is actually present in it; never infer that something is missing because the excerpt stops.
- If coverage is complete, return an empty array. An empty array is the expected, common answer — do not invent gaps to seem thorough.

Return ONLY JSON: {"missing":["<spec area absent from the syllabus>", ...]}`;

const REPAIR_SYSTEM = `You are repairing a syllabus that an audit found incomplete. You are given the existing topic titles and a list of specification areas that are missing.

For each missing area, either:
- assign it to the EXISTING topic where it most naturally belongs, or
- create a new topic, but only if it genuinely does not fit any existing one.

Every subtopic you add must be session-grain: ONE self-contained idea plus immediate practice, learnable in a single ~20-30 minute sitting. Never restate a missing area verbatim as a subtopic if it is broader than one sitting — split it.

Return ONLY the ADDITIONS, as JSON: {"additions":[{"title":"<existing or new topic title>","subtopics":["...","..."]}]}`;

// ---------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------

async function buildSkeleton(id: SyllabusIdentity, goal: string, spec: string): Promise<string[]> {
  const user = `${identityLine(id, goal)}${spec ? `\n\nOFFICIAL SPECIFICATION EXCERPT — base the topic list on this real content, in the terminology it uses. Do not invent top-level topics absent from it; use your own judgment only to fill gaps left by truncation:\n"""\n${spec}\n"""` : ""}\n\nProduce the exhaustive topic list now.`;
  const data = await askJson(SKELETON_SYSTEM, user);
  if (!Array.isArray(data?.topics)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of data.topics) {
    const title = String(t ?? "").trim();
    if (!title) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(title);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

async function expandTopics(id: SyllabusIdentity, goal: string, titles: string[]): Promise<Record<string, string[]>> {
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += EXPAND_BATCH_SIZE) {
    batches.push(titles.slice(i, i + EXPAND_BATCH_SIZE));
  }

  const maps = await pooled(batches, EXPAND_CONCURRENCY, async (batch) => {
    const user = `${identityLine(id, goal)}\n\nTopics: ${JSON.stringify(batch)}\n\nExpand these into session-grain subtopics.`;
    const data = await askJson(EXPAND_SYSTEM, user);
    const out: Record<string, string[]> = {};
    if (Array.isArray(data?.topics)) {
      for (const t of data.topics) {
        const title = String(t?.title ?? "").trim();
        const subs = Array.isArray(t?.subtopics)
          ? t.subtopics.map((s: unknown) => String(s ?? "").trim()).filter(Boolean).slice(0, MAX_SUBTOPICS_PER_TOPIC)
          : [];
        if (title && subs.length) out[title] = subs;
      }
    }
    return out;
  });

  return Object.assign({}, ...maps);
}

/**
 * Match an expansion back to the skeleton title it was asked about.
 *
 * The model is told to echo titles verbatim and usually does, but a stray "The " or a changed dash
 * silently orphans a whole topic — which used to surface as a topic whose only subtopic was its own
 * title. Exact match first, then a normalized match, then give up.
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

/** Audit the assembled tree against the spec excerpt, then repair once. Returns the coverage record. */
async function verifyAndRepair(
  id: SyllabusIdentity,
  goal: string,
  topics: SyllabusTopic[],
  spec: { text: string; sourceUrl: string },
): Promise<SyllabusCoverage> {
  const summary = topics.map((t) => `${t.title}: ${t.subtopics.join("; ")}`).join("\n");
  const auditUser = `${identityLine(id, goal)}\n\nOFFICIAL SPECIFICATION EXCERPT:\n"""\n${spec.text}\n"""\n\nGENERATED SYLLABUS:\n"""\n${summary}\n"""\n\nList the specification areas the syllabus does not cover.`;
  const audit = await askJson(AUDIT_SYSTEM, auditUser);

  // A failed audit is NOT a pass. We cannot claim `grounded` for a tree we did not manage to check,
  // and `unverified` is never cached — so a transient audit failure costs this student nothing and
  // correctly keeps an unchecked tree out of the global cache.
  if (!audit || !Array.isArray(audit.missing)) {
    console.error("coverage audit did not return a verdict — treating tree as unverified");
    return { verdict: "unverified", source_url: spec.sourceUrl };
  }

  const missing = audit.missing.map((m: unknown) => String(m ?? "").trim()).filter(Boolean);
  if (missing.length === 0) {
    return { verdict: "grounded", source_url: spec.sourceUrl };
  }

  // --- One repair pass. Deliberately not a loop: repeated repair converges slowly and burns an
  // authoring budget on diminishing returns. Whatever is still missing is recorded honestly. ---
  const repairUser = `${identityLine(id, goal)}\n\nEXISTING TOPIC TITLES:\n${JSON.stringify(topics.map((t) => t.title))}\n\nMISSING SPECIFICATION AREAS:\n${JSON.stringify(missing)}\n\nReturn the additions now.`;
  const repair = await askJson(REPAIR_SYSTEM, repairUser);

  let repaired = 0;
  if (Array.isArray(repair?.additions)) {
    for (const add of repair.additions) {
      const title = String(add?.title ?? "").trim();
      const subs = Array.isArray(add?.subtopics)
        ? add.subtopics.map((s: unknown) => String(s ?? "").trim()).filter(Boolean)
        : [];
      if (!title || subs.length === 0) continue;

      const existing = topics.find((t) => t.title.toLowerCase() === title.toLowerCase());
      if (existing) {
        const have = new Set(existing.subtopics.map((s) => s.toLowerCase()));
        for (const s of subs) {
          if (have.has(s.toLowerCase())) continue;
          if (existing.subtopics.length >= MAX_SUBTOPICS_PER_TOPIC) break;
          existing.subtopics.push(s);
          repaired++;
        }
      } else if (topics.length < MAX_TOPICS) {
        topics.push({ title, subtopics: subs.slice(0, MAX_SUBTOPICS_PER_TOPIC) });
        repaired += subs.length;
      }
    }
  }

  // The repair pass is not re-audited (that would be the loop we just ruled out), so `missing` is
  // recorded as the gaps the audit FOUND, annotated with whether anything was actually added. This
  // is deliberately the pessimistic reading: it is better for the coverage record to overstate the
  // gap than for a cached tree to claim a completeness nobody checked.
  console.log(`coverage repair added ${repaired} subtopic(s) for ${missing.length} reported gap(s)`);
  return repaired > 0
    ? { verdict: "grounded", source_url: spec.sourceUrl, missing }
    : { verdict: "unverified", source_url: spec.sourceUrl, missing };
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
    // The onboarding conversation, used only for spec resolution (it reads the student's own words
    // to work out which board/exam is meant). Falls back to a synthesized line when absent.
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

    // --- Cache hit: the whole point of the layer. No AI call, no write, instant onboarding. ---
    if (supabase && signature) {
      const { data: row, error } = await supabase
        .from("syllabus_trees")
        .select("id, tree, coverage")
        .eq("signature", signature)
        .eq("tree_version", SYLLABUS_TREE_VERSION)
        .maybeSingle();
      if (error) console.error("syllabus_trees lookup failed (will author):", error);
      if (row?.tree) {
        // A stored tree is still model output from a possibly older contract. Re-validate: a row that
        // no longer validates is re-authored rather than served as a broken syllabus.
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

    // --- Miss: author it. ---
    const spec = await resolveOfficialSpec(messages).catch((e) => {
      console.error("spec resolution failed:", e);
      return null;
    });

    const skeleton = await buildSkeleton(identity, goal, spec?.text || "");
    if (skeleton.length < 3) {
      return json({ ok: false, errors: ["could not produce a topic skeleton for this goal"] });
    }

    const expansions = await expandTopics(identity, goal, skeleton);
    const topics: SyllabusTopic[] = [];
    for (const title of skeleton) {
      const subs = lookupExpansion(expansions, title);
      // A topic that failed to expand is DROPPED, not padded with its own title as a lone subtopic.
      // The old client path padded, which produced tracks whose sections looked complete but opened
      // one unteachable mega-session each. A visibly shorter track is the honest failure.
      if (subs && subs.length) topics.push({ title, subtopics: subs });
    }
    if (topics.length < Math.ceil(skeleton.length * 0.6)) {
      return json({ ok: false, errors: [`only ${topics.length}/${skeleton.length} topics expanded`] });
    }

    const coverage: SyllabusCoverage = spec
      ? await verifyAndRepair(identity, goal, topics, { text: spec.text, sourceUrl: spec.sourceUrl })
      // No spec resolved: the tree is perfectly usable, but there is nothing to check it against, so
      // it must not enter the global cache. This is the `cacheable ⟺ verifiable` gate in force.
      : { verdict: "unverified" };

    const validated = validateSyllabusTree({ topics, coverage });
    if (!validated.ok) {
      return json({ ok: false, errors: validated.errors });
    }
    const tree = validated.tree;

    // --- Cache write: only a canonical identity with a verified tree is ever shared. ---
    let treeId: string | null = null;
    if (supabase && signature && coverage.verdict === "grounded") {
      const ai = await getAIConfig("authoring");
      const { data: written, error: writeErr } = await supabase
        .from("syllabus_trees")
        .upsert(
          {
            signature,
            tree_version: SYLLABUS_TREE_VERSION,
            subject: identity.subject,
            level: identity.level,
            board: identity.board,
            tree,
            coverage,
            model: ai.model,
          },
          // Must name BOTH columns: the unique constraint is (signature, tree_version), and naming
          // only `signature` would match no constraint and turn the upsert into a failing insert.
          { onConflict: "signature,tree_version" },
        )
        .select("id")
        .maybeSingle();
      if (writeErr) console.error("syllabus_trees upsert failed (returning tree uncached):", writeErr);
      treeId = written?.id ?? null;
    }

    console.log(
      `authored syllabus: ${tree.topics.length} topics / ${countSubtopics(tree)} subtopics, ` +
      `coverage=${coverage.verdict}, canonical=${canonical}, cached=${treeId !== null}`,
    );

    return json({ ok: true, cached: false, treeId, tree });
  } catch (e) {
    console.error("author-syllabus-tree error:", e);
    return json({ ok: false, errors: [e instanceof Error ? e.message : "unknown error"] }, 500);
  }
});
