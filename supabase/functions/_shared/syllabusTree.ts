// The Syllabus Tree layer — shared contract.
//
// A syllabus tree is the topic/subtopic decomposition for a NAMED external syllabus (e.g.
// `AQA · A-Level · Physics`), authored ONCE and cached globally, so that every student pursuing that
// goal gets the same complete, audited curriculum instead of a fresh per-signup dice roll.
//
// This is the same economic argument as the lesson plan layer, one level up — and it is what makes
// that layer actually pay off. `lesson_plans` is keyed on the SUBTOPIC STRING; while every student
// generates their own subtopic titles, those strings diverge and the plan cache barely hits. Fixing
// the tree fixes the keys, and the plan cache starts concentrating instead of fragmenting.
//
// THE GATE: CACHEABLE ⟺ VERIFIABLE.
//
// A tree is only cached when the identity names a real, externally-defined syllabus. That is not a
// convenience threshold, it is a correctness one: a globally-shared tree is only *right* when there
// is an external definition it can be checked against. Without a board there is no such definition,
// so there is nothing to verify coverage against and no basis for serving one student's tree to
// another. Bespoke goals ("help me understand quantum field theory") still get a full tree — it is
// simply authored for them and not written to the cache. See `hasCanonicalIdentity`.

export const SYLLABUS_TREE_VERSION = 1;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export type SyllabusTopic = {
  /** the topic title, as it will appear on the track */
  title: string;
  /**
   * Session-grain subtopics: one self-contained idea plus its immediate practice, learnable in a
   * single sitting. This grain is load-bearing — it is what a `lesson_plans` row is keyed on, and
   * what one session teaches.
   */
  subtopics: string[];
};

/**
 * The verification record for a tree, stored alongside it.
 *
 * This exists because caching multiplies quality in BOTH directions: an incomplete tree, once
 * cached, silently truncates the syllabus for every student who ever pursues that goal. Structural
 * validation cannot catch that — only a check against the real spec can. So coverage is recorded as
 * data, not asserted in a prompt, and a tree that could not be checked is never cached.
 */
export type SyllabusCoverage = {
  /**
   * `grounded`  — checked against a resolved official spec.
   * `unverified`— no spec could be resolved; the tree is usable but MUST NOT be cached.
   */
  verdict: "grounded" | "unverified";
  /** where the spec excerpt came from, so a coverage claim can be audited by hand */
  source_url?: string;
  /**
   * Spec areas still absent after the repair pass. Deliberately recorded rather than hidden: a tree
   * that is 95% complete and honest about the missing 5% is far more useful than one that claims
   * completeness, and this list is the natural input to the next authoring improvement.
   */
  missing?: string[];
};

export type SyllabusTree = {
  topics: SyllabusTopic[];
  coverage: SyllabusCoverage;
};

export type SyllabusIdentity = {
  subject?: string | null;
  level?: string | null;
  board?: string | null;
};

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

/** lowercase, collapse whitespace, strip punctuation — so trivial title variations share a tree */
function normalizePart(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable, global cache key for a tree.
 *
 * Deliberately NOT keyed on the student's freeform goal text or the track title. Those vary
 * endlessly for what is the same syllabus ("A* in A-level further maths" vs "Edexcel FM") and
 * keying on them would fragment the cache into single-use rows — the exact failure this layer
 * exists to fix.
 */
export async function treeSignature(id: SyllabusIdentity): Promise<string> {
  const raw = [id.subject, id.level, id.board].map(normalizePart).join("|");
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Whether this identity may be written to the GLOBAL cache.
 *
 * All three parts are required, and board is the load-bearing one. Two students who both say
 * "physics at university" may mean wildly different courses; serving one's tree to the other is a
 * silent, permanent wrong answer. A named board/exam is what makes the goal externally defined —
 * and therefore both shareable and checkable.
 *
 * A `false` here is NOT a failure: the caller still authors a full tree for that student. It only
 * means the result stays private to them.
 */
export function hasCanonicalIdentity(id: SyllabusIdentity): boolean {
  return (
    normalizePart(id.subject).length > 0 &&
    normalizePart(id.level).length > 0 &&
    normalizePart(id.board).length > 0
  );
}

// ---------------------------------------------------------------------------
// Validation
//
// Model output is never trusted. Validation COERCES what it safely can and REJECTS what it can't.
// A malformed tree must read as NO tree — the caller then falls back — because a half-tree cached
// globally is a truncated syllabus for every future student, which is worse than no cache at all.
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Caps. Generous enough for a full multi-subject exam (JEE-scale), tight enough to bound cost. */
export const MAX_TOPICS = 60;
export const MAX_SUBTOPICS_PER_TOPIC = 12;
const MIN_TOPICS = 3;

export type TreeValidationResult =
  | { ok: true; tree: SyllabusTree }
  | { ok: false; errors: string[] };

export function validateSyllabusTree(raw: unknown): TreeValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["tree is not an object"] };
  const r = raw as Record<string, unknown>;

  const topics: SyllabusTopic[] = [];
  const seenTitles = new Set<string>();
  for (const t of arr(r.topics)) {
    if (!t || typeof t !== "object") continue;
    const tt = t as Record<string, unknown>;
    const title = str(tt.title);
    if (!title) continue;

    // Duplicate topic titles would produce two identical sections on the track and, worse, two
    // different `lesson_plans` keys colliding on the same material. Drop the later one.
    const key = normalizePart(title);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    const seenSubs = new Set<string>();
    const subtopics: string[] = [];
    for (const s of arr(tt.subtopics)) {
      const sub = str(s);
      if (!sub) continue;
      const sk = normalizePart(sub);
      if (seenSubs.has(sk)) continue;
      seenSubs.add(sk);
      subtopics.push(sub);
      if (subtopics.length >= MAX_SUBTOPICS_PER_TOPIC) break;
    }

    // A topic with no subtopics is not teachable — there is nothing to open a session on. Rejecting
    // the topic (rather than silently substituting the topic title as its own subtopic, which the
    // old client path did) keeps a malformed expansion visible instead of producing a plausible-
    // looking track whose sections are one giant untaught lesson each.
    if (subtopics.length === 0) continue;

    topics.push({ title, subtopics });
    if (topics.length >= MAX_TOPICS) break;
  }

  if (topics.length < MIN_TOPICS) {
    errors.push(`only ${topics.length} usable topic(s); a syllabus needs at least ${MIN_TOPICS}`);
  }

  const rawCoverage = (r.coverage && typeof r.coverage === "object" ? r.coverage : {}) as Record<string, unknown>;
  const verdict = rawCoverage.verdict === "grounded" ? "grounded" : "unverified";
  const coverage: SyllabusCoverage = { verdict };
  const sourceUrl = str(rawCoverage.source_url);
  if (sourceUrl) coverage.source_url = sourceUrl;
  const missing = arr(rawCoverage.missing).map(str).filter(Boolean);
  if (missing.length) coverage.missing = missing;

  if (errors.length) return { ok: false, errors };
  return { ok: true, tree: { topics, coverage } };
}

/** Total teachable sessions in a tree — the honest "how big is this" number for UI and logging. */
export function countSubtopics(tree: SyllabusTree): number {
  return tree.topics.reduce((n, t) => n + t.subtopics.length, 0);
}
