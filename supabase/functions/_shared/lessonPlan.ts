// The Lesson Plan layer — shared contract.
//
// A lesson plan is the per-subtopic artifact authored ONCE at the highest available quality and
// cached globally, so that live teaching turns EXECUTE a plan instead of improvising one. See
// docs/lesson-plan-layer.md for the full design and rationale.
//
// The plan is a MAP, NOT A SCRIPT. Every consumer of this module must preserve that: the plan fixes
// the terrain and the destination (which mechanism must land, which misconception is in the way,
// which checkpoints must be met), never the route, the wording, or the turn order. A session that
// reads as though it is reciting a plan is a regression, not a success.

export const LESSON_PLAN_VERSION = 1;

export type EvidenceType =
  | "prediction"
  | "self_explanation"
  | "novel_application"
  | "derivation"
  | "calculation";

export const EVIDENCE_TYPES: EvidenceType[] = [
  "prediction",
  "self_explanation",
  "novel_application",
  "derivation",
  "calculation",
];

export type DerivationStep = {
  /** the result being established */
  claim: string;
  /** the mechanism that FORCES the claim — never a restatement of it */
  mechanism: string;
  /** the load-bearing assumption the step rests on */
  rests_on: string;
  /** one clause: drop that assumption and it fails, because ... */
  counterfactual: string;
  /** the axiom, or already-known concept, this step terminates in */
  bottoms_out_at: string;
};

export type Misconception = {
  /** the wrong model, stated as the student would hold it */
  belief: string;
  /** what makes it genuinely tempting — never "students are careless" */
  why_its_tempting: string;
  /** the question whose answer exposes the belief */
  diagnostic: string;
  /** a DIFFERENT angle to re-teach from — not a repeat of the first explanation */
  reteach_angle: string;
};

export type IsomorphicCase = {
  /** a concrete setting, superficially far from its partner */
  setting: string;
  /** what plays which structural role in this setting */
  mapping: string;
};

export type SceneBeat = {
  /** the checkpoint after which this picture is earned (1-indexed) */
  after_checkpoint: number;
  concept: string;
  /** what must become VISIBLE for the why to feel undeniable */
  must_show: string;
  /** what the student drags/slides, and what they watch survive or break */
  must_manipulate: string;
  /** what they would SEE happen if the wrong model were true */
  falsifies: string;
  form_hint: string;
};

export type Checkpoint = {
  id: number;
  /** a demonstrable act, gradeable from a transcript — not "understands X" */
  must_demonstrate: string;
  evidence_type: EvidenceType;
};

export type LessonPlan = {
  core_idea: string;
  prerequisites: { concept: string; why_needed: string }[];
  derivation_chain: DerivationStep[];
  misconceptions: Misconception[];
  isomorphic_cases: IsomorphicCase[];
  shared_structure: string;
  scene_beats: SceneBeat[];
  checkpoints: Checkpoint[];
  terminal_transfer: {
    problem: string;
    why_novel: string;
    acceptable_reasoning: string;
  };
  notation: { symbol: string; read_as: string; note?: string }[];
  common_dead_ends: string[];
};

export type PlanIdentity = {
  subject?: string | null;
  level?: string | null;
  board?: string | null;
  topic?: string | null;
  subtopic?: string | null;
};

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

/** lowercase, collapse whitespace, strip punctuation — so trivial title variations share a plan */
function normalizePart(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable, global cache key for a plan. Board is included because exam boards genuinely differ on
 * emphasis, notation and scope; an unknown board normalizes to "" so unbranded tracks share a plan.
 */
export async function planSignature(id: PlanIdentity): Promise<string> {
  const raw = [id.subject, id.level, id.board, id.topic, id.subtopic].map(normalizePart).join("|");
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A plan is only worth authoring if we at least know what the subtopic is. */
export function hasPlanIdentity(id: PlanIdentity): boolean {
  return normalizePart(id.subtopic).length > 0;
}

// ---------------------------------------------------------------------------
// Validation
//
// Model output is never trusted. Validation COERCES what it safely can and REJECTS what it can't,
// because a malformed plan must degrade to "no plan" (today's behaviour) rather than corrupt a
// session. Rejection is always preferable to a half-plan.
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type ValidationResult =
  | { ok: true; plan: LessonPlan }
  | { ok: false; errors: string[] };

export function validateLessonPlan(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["plan is not an object"] };
  const r = raw as Record<string, unknown>;

  const core_idea = str(r.core_idea);
  if (!core_idea) errors.push("core_idea is required");

  const derivation_chain: DerivationStep[] = arr(r.derivation_chain)
    .map((s) => {
      const o = (s || {}) as Record<string, unknown>;
      return {
        claim: str(o.claim),
        mechanism: str(o.mechanism),
        rests_on: str(o.rests_on),
        counterfactual: str(o.counterfactual),
        bottoms_out_at: str(o.bottoms_out_at),
      };
    })
    .filter((s) => s.claim && s.mechanism);
  if (derivation_chain.length === 0) {
    errors.push("derivation_chain needs at least one step with a claim and a mechanism");
  }

  const checkpoints: Checkpoint[] = arr(r.checkpoints)
    .map((c, i) => {
      const o = (c || {}) as Record<string, unknown>;
      const et = str(o.evidence_type) as EvidenceType;
      return {
        id: typeof o.id === "number" && o.id > 0 ? o.id : i + 1,
        must_demonstrate: str(o.must_demonstrate),
        evidence_type: EVIDENCE_TYPES.includes(et) ? et : "self_explanation",
      };
    })
    .filter((c) => c.must_demonstrate);
  if (checkpoints.length === 0) {
    errors.push("checkpoints needs at least one demonstrable item");
  }
  // Checkpoints are the spine: completion is graded against them, so they must be uniquely
  // addressable and ordered.
  checkpoints.forEach((c, i) => (c.id = i + 1));

  const misconceptions: Misconception[] = arr(r.misconceptions)
    .map((m) => {
      const o = (m || {}) as Record<string, unknown>;
      return {
        belief: str(o.belief),
        why_its_tempting: str(o.why_its_tempting),
        diagnostic: str(o.diagnostic),
        reteach_angle: str(o.reteach_angle),
      };
    })
    .filter((m) => m.belief && m.reteach_angle);

  const isomorphic_cases: IsomorphicCase[] = arr(r.isomorphic_cases)
    .map((c) => {
      const o = (c || {}) as Record<string, unknown>;
      return { setting: str(o.setting), mapping: str(o.mapping) };
    })
    .filter((c) => c.setting);

  // scene_beats are legitimately EMPTY for subtopics that do not earn a picture (definitions,
  // notation, pure procedure). An empty array is a valid, correct plan — never coerce one in.
  const scene_beats: SceneBeat[] = arr(r.scene_beats)
    .map((b) => {
      const o = (b || {}) as Record<string, unknown>;
      return {
        after_checkpoint:
          typeof o.after_checkpoint === "number" && o.after_checkpoint > 0 ? o.after_checkpoint : 1,
        concept: str(o.concept),
        must_show: str(o.must_show),
        must_manipulate: str(o.must_manipulate),
        falsifies: str(o.falsifies),
        form_hint: str(o.form_hint),
      };
    })
    .filter((b) => b.concept && b.must_show);

  const tt = (r.terminal_transfer || {}) as Record<string, unknown>;
  const terminal_transfer = {
    problem: str(tt.problem),
    why_novel: str(tt.why_novel),
    acceptable_reasoning: str(tt.acceptable_reasoning),
  };
  if (!terminal_transfer.problem) errors.push("terminal_transfer.problem is required");

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    plan: {
      core_idea,
      prerequisites: arr(r.prerequisites)
        .map((p) => {
          const o = (p || {}) as Record<string, unknown>;
          return { concept: str(o.concept), why_needed: str(o.why_needed) };
        })
        .filter((p) => p.concept),
      derivation_chain,
      misconceptions,
      isomorphic_cases,
      shared_structure: str(r.shared_structure),
      scene_beats,
      checkpoints,
      terminal_transfer,
      notation: arr(r.notation)
        .map((n) => {
          const o = (n || {}) as Record<string, unknown>;
          return { symbol: str(o.symbol), read_as: str(o.read_as), note: str(o.note) };
        })
        .filter((n) => n.symbol),
      common_dead_ends: arr(r.common_dead_ends).map(str).filter(Boolean),
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/**
 * Renders the plan into the teaching prompt.
 *
 * The framing here is deliberate and must not be softened into a script: the plan is presented as
 * MATERIAL THE TUTOR DRAWS ON, and the tutor is told explicitly to route by the student in front of
 * it. Fixing the destination while leaving the path free is the entire design.
 */
export function renderPlanForTeaching(plan: LessonPlan): string {
  const lines: string[] = [];

  lines.push(`
LESSON PLAN FOR THIS SUBTOPIC — authored in advance, at higher quality than you can reach mid-turn.
USE IT AS A MAP, NEVER AS A SCRIPT. It fixes WHERE the student must get to and WHAT terrain is in the
way; it does NOT fix your route, your wording, your turn order, or your pace. Read the student in
front of you and adapt freely — but do not finish this subtopic with a checkpoint unmet, and do not
recite this plan back at them. Never mention the plan's existence.

CORE IDEA (the one thing that, once grasped, forces the rest): ${plan.core_idea}`);

  if (plan.checkpoints.length) {
    lines.push(`
CHECKPOINTS — the student must DEMONSTRATE each of these before this subtopic is complete. Before you
reply, work out silently which are already evidenced in the transcript, and aim this turn at the
lowest unmet one. Do not announce checkpoint numbers to the student.
${plan.checkpoints.map((c) => `  ${c.id}. [${c.evidence_type}] ${c.must_demonstrate}`).join("\n")}`);
  }

  if (plan.derivation_chain.length) {
    lines.push(`
DERIVATION CHAIN — this is the WHY, already worked out and bottomed out. Lead with the mechanism, as
HARD RULE 8 requires; you now have it to hand rather than having to construct it live.
${plan.derivation_chain
  .map(
    (s, i) =>
      `  ${i + 1}. CLAIM: ${s.claim}\n     MECHANISM: ${s.mechanism}\n     RESTS ON: ${s.rests_on}\n     COUNTERFACTUAL: ${s.counterfactual}\n     BOTTOMS OUT AT: ${s.bottoms_out_at}`,
  )
  .join("\n")}`);
  }

  if (plan.misconceptions.length) {
    lines.push(`
LIKELY MISCONCEPTIONS — pre-diagnosed. If the student shows one, you already have a DIFFERENT angle
to re-teach from (HARD RULE 7); do not repeat the explanation that just failed. Raise one pre-emptively
only when it is genuinely in the way — never parade them all.
${plan.misconceptions
  .map(
    (m) =>
      `  • BELIEF: ${m.belief}\n    TEMPTING BECAUSE: ${m.why_its_tempting}\n    EXPOSE WITH: ${m.diagnostic}\n    RE-TEACH VIA: ${m.reteach_angle}`,
  )
  .join("\n")}`);
  }

  if (plan.isomorphic_cases.length >= 2) {
    lines.push(`
ISOMORPHIC PAIR (HARD RULE 2) — two settings with the SAME structure. Lead with one, let it land,
then contrast. The student must NAME the shared structure themselves; never name it for them first.
${plan.isomorphic_cases.map((c) => `  • ${c.setting}\n    ROLES: ${c.mapping}`).join("\n")}
  SHARED STRUCTURE they should arrive at: ${plan.shared_structure}`);
  }

  if (plan.scene_beats.length) {
    lines.push(`
EARNED SCENES — the moments where a picture genuinely carries the mechanism. Emit a <scene-request>
at roughly these points and nowhere else; include what must be manipulable and what it falsifies.
${plan.scene_beats
  .map(
    (b) =>
      `  • after checkpoint ${b.after_checkpoint} — ${b.concept}\n    SHOW: ${b.must_show}\n    MANIPULATE: ${b.must_manipulate}\n    FALSIFIES: ${b.falsifies}\n    FORM: ${b.form_hint}`,
  )
  .join("\n")}`);
  } else {
    lines.push(`
EARNED SCENES: none. This subtopic was judged not to need a picture — do NOT request a scene for it.
A forced scene here is the "irrelevant, terrible visualisation" failure.`);
  }

  lines.push(`
TERMINAL TRANSFER — the problem that certifies mastery (HARD RULE 9). Do not show it early, and do
not water it down; it is deliberately not a re-skin of anything you will have worked through.
  PROBLEM: ${plan.terminal_transfer.problem}
  WHY IT IS NOVEL: ${plan.terminal_transfer.why_novel}
  A CORRECT LINE OF REASONING CONTAINS: ${plan.terminal_transfer.acceptable_reasoning}`);

  if (plan.notation.length) {
    lines.push(`
NOTATION to introduce explicitly rather than assume:
${plan.notation.map((n) => `  • ${n.symbol} — ${n.read_as}${n.note ? ` (${n.note})` : ""}`).join("\n")}`);
  }

  if (plan.common_dead_ends.length) {
    lines.push(`
COMMON DEAD ENDS — where students stall procedurally:
${plan.common_dead_ends.map((d) => `  • ${d}`).join("\n")}`);
  }

  return lines.join("\n");
}

/** Compact rendering for the assessment pass — the rubric needs the bar, not the teaching material. */
export function renderPlanForAssessment(plan: LessonPlan): string {
  return `
THIS SUBTOPIC'S REQUIRED CHECKPOINTS — the completion bar is defined by these, not by your general
impression of the transcript. A session that shows good engagement but leaves a checkpoint
undemonstrated is NOT complete.
${plan.checkpoints.map((c) => `  ${c.id}. [${c.evidence_type}] ${c.must_demonstrate}`).join("\n")}

TERMINAL TRANSFER that certifies mastery: ${plan.terminal_transfer.problem}
  A correct line of reasoning contains: ${plan.terminal_transfer.acceptable_reasoning}

Report per-checkpoint outcomes in "checkpoints_met" (the ids demonstrated) and "checkpoints_unmet"
(the ids not demonstrated). Judge each strictly from evidence in the transcript.`;
}
