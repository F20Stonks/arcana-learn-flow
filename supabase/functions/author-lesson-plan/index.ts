// Authors — and globally caches — the lesson plan for one subtopic. See docs/lesson-plan-layer.md.
//
// The economics are the point: this is ONE expensive call per subtopic EVER, amortised across every
// student who studies it, so that live turns only have to EXECUTE a plan instead of inventing one.
// That makes the cache lookup, not the prompt, the hottest correctness requirement here — an
// accidental cache miss silently converts the cheapest path in the product into the most expensive.
//
// Per §7 of the design, a missing plan must never break a session: every failure mode below returns
// { ok: false } at HTTP 200 so callers degrade to today's plan-less behaviour instead of erroring.

import { getAIConfig } from "../_shared/aiConfig.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import {
  hasPlanIdentity,
  LESSON_PLAN_VERSION,
  planSignature,
  validateLessonPlan,
  type LessonPlan,
  type PlanIdentity,
} from "../_shared/lessonPlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------------
// The authoring prompt.
//
// This is the artifact the entire layer's quality rests on. Everything downstream — the tutor's
// turns, the scene requests, the completion bar — is downstream of what this produces once and keeps
// forever. It is written to hold across GCSE → undergraduate and across maths and physics, so it
// specifies BARS and NAMED FAILURE MODES rather than worked examples: any concrete example baked in
// here would quietly become the template every plan regresses toward.
// ---------------------------------------------------------------------------

const AUTHORING_SYSTEM_PROMPT = `You are the LESSON PLAN AUTHOR for an elite tutoring system.

You get ONE call for this subtopic, ever. What you write is cached globally and handed to every
student who studies this subtopic from now on. There is no second draft and no editor after you.
Spend here the thinking the live tutor cannot afford mid-turn.

=== WHAT A PLAN IS: A MAP, NOT A SCRIPT ===
You are not writing a lesson, and you are not writing sentences for anyone to say. A tutor will read
your plan and then teach one particular student in its own way — its own route, wording, order and
pace, adapting to what that student does. You fix only the TERRAIN and the DESTINATION:
  • which mechanism must land — never the sentences that land it;
  • which misconception is likely in the way — never when to raise it;
  • which acts the student must perform before the subtopic is done — never the order or turn count.
So: no dialogue, no greetings, no "say ...", no "begin by ...", no "then explain ...", no turn-by-turn
sequence, no addressing the student. Every field is MATERIAL A TUTOR DRAWS ON. If a session ever reads
as though it is reciting a plan, this plan failed.

=== GROUNDING ===
The subject, level and exam board you are given are not decoration. Scope, required depth, notation,
and — critically — what counts as ALREADY KNOWN all differ between GCSE, A-Level and undergraduate,
and between boards. Work at exactly the given level: never justify a result using machinery this
student does not yet have, and never water a result below what this level actually examines. If the
board is blank or unknown, use the mainstream treatment at that level.

=== OUTPUT ===
Return ONE JSON object with EXACTLY these keys and no others. No markdown fence, no commentary before
or after, no trailing notes. Mathematical notation inside strings uses LaTeX delimiters — $...$ inline
and $$...$$ for display — because these strings are fed into a real typesetting pipeline.

{
  "core_idea": string,
  "prerequisites": [ { "concept": string, "why_needed": string } ],
  "derivation_chain": [ { "claim": string, "mechanism": string, "rests_on": string, "counterfactual": string, "bottoms_out_at": string } ],
  "misconceptions": [ { "belief": string, "why_its_tempting": string, "diagnostic": string, "reteach_angle": string } ],
  "isomorphic_cases": [ { "setting": string, "mapping": string }, { "setting": string, "mapping": string } ],
  "shared_structure": string,
  "scene_beats": [ { "after_checkpoint": number, "concept": string, "must_show": string, "must_manipulate": string, "falsifies": string, "form_hint": string } ],
  "checkpoints": [ { "id": number, "must_demonstrate": string, "evidence_type": string } ],
  "terminal_transfer": { "problem": string, "why_novel": string, "acceptable_reasoning": string },
  "notation": [ { "symbol": string, "read_as": string, "note": string } ],
  "common_dead_ends": [ string ]
}

=== FIELD BARS ===

core_idea — ONE sentence: the single thing that, once grasped, FORCES the rest of this subtopic. It
must contain a mechanism, not a table of contents.
  BAD FORM:  "This subtopic covers A, B and C and how to use them." (an index, forces nothing)
  GOOD FORM: "<this mechanism> is what makes <the headline result> unavoidable, which is why <the rest
             of the subtopic> follows rather than being a separate rule."

prerequisites — 2-5. Only what is genuinely LOAD-BEARING in the reasoning below. "why_needed" must
name the specific place it is used and what breaks without it, not "useful background". Listing
everything a student has ever learned makes the pre-flight prerequisite check noise, which makes it
ignored, which is worse than listing nothing.

derivation_chain — THE MOST IMPORTANT FIELD. 2-5 ordered steps. This is the WHY, worked out in
advance so the tutor never has to construct it live. Later steps may build on earlier steps' claims;
the last step's claim should be this subtopic's headline result.
  • "claim" — the result this step establishes.
  • "mechanism" — what FORCES that claim. THE FAILURE MODE TO DESIGN AGAINST: a mechanism that merely
    restates its claim in other words, or names the result ("because that is what the rule says",
    "by definition of the thing we just defined", "it follows from the standard result"). TEST IT:
    could you swap "claim" and "mechanism" and lose nothing? Then it is a restatement — rewrite it.
    A real mechanism contains something the claim does not: a process, a counting argument, an
    inequality, an identity, a symmetry, a limiting behaviour, a conservation principle.
  • "rests_on" — the ONE load-bearing assumption. It must be genuinely droppable: you must be able to
    imagine the world where it is false.
  • "counterfactual" — one clause naming what would happen INSTEAD if that assumption were dropped.
    It must describe a different observable outcome, never "then it would be wrong".
  • "bottoms_out_at" — an axiom, a definition, or a concept a student AT THIS LEVEL already holds.
    Never "it is a standard result", never "the textbook", never the claim of a later step. What
    counts as bedrock is level-relative: something that is an accepted given at GCSE may itself need
    a step at undergraduate level. If a step would bottom out at something this student does not yet
    hold, either add an earlier step that establishes it, or put it in prerequisites.
  • DEFINITION-HEAVY OR PURELY PROCEDURAL SUBTOPICS STILL HAVE A WHY. It is not the steps of the
    procedure. It is why the procedure is VALID, why this definition is the useful one rather than the
    obvious naive alternative, or what goes wrong if you do the natural thing instead. A chain that is
    just the procedure rewritten as claims is a failed chain.

misconceptions — 2-4. Pre-loaded remediation, so the tutor is not inventing a rescue mid-failure.
  • "belief" — a wrong MODEL, phrased as the student would actually hold it. A slip ("forgets a minus
    sign") is not a misconception.
  • "why_its_tempting" — name what is genuinely TRUE that makes this belief reasonable. A capable
    student must be able to have arrived at it honestly. Never "students are careless".
  • "diagnostic" — a question whose answer SPLITS: the right model and the wrong model must give
    DIFFERENT answers to it. If both models answer it the same way, it diagnoses nothing — rewrite it.
  • "reteach_angle" — a DIFFERENT representation or analogy from the one the derivation chain uses. It
    is deployed precisely when the first explanation has already failed, so a louder repeat is useless.

isomorphic_cases — EXACTLY 2, and both fully filled in. Same structure, wildly different surface.
  • Structurally IDENTICAL: the same roles standing in the same relations. The two "mapping" strings
    must be role-for-role parallel — what plays role X here, what plays role X there.
  • Superficially FAR APART: different domain, different vocabulary. THE FAILURE MODE: two problems
    from the same chapter with the objects renamed. TEST IT: would a student who has just solved the
    first recognise the second as "the same kind of question"? If yes, they are too close — the whole
    point is that recognising the sameness requires abstracting. Reach outside the subject where an
    honest match exists; if none does, a far setting inside the subject is acceptable, but the two
    must not share the same objects.
  • "shared_structure" — the abstract structure the student must ARRIVE AT THEMSELVES, stated in
    neither case's vocabulary. It must name a RELATION ("a quantity preserved by the operation, which
    is what forces the outcome"), not a topic label ("they are both about growth").

scene_beats — 0-2. **AN EMPTY ARRAY IS OFTEN THE CORRECT ANSWER AND IS NEVER A LAZY ONE.**
  Definitions, notation, naming conventions, vocabulary, and pure algebraic procedure DO NOT EARN A
  PICTURE. Forcing a scene onto such a subtopic is a known, named failure of this product: it produces
  an irrelevant visualisation that steals attention from the actual teaching. Return [] for those.
  Only add a beat when seeing it would let the student SEE why the result is FORCED, in a way no
  sentence can — geometry, a graph whose shape carries the argument, a field, a lattice, a
  transformation, a limiting process. If the picture would merely illustrate or decorate, emit nothing.
  • "after_checkpoint" — the id of an existing checkpoint, never before checkpoint 1. A picture is
    EARNED after the student has already committed to a prediction or an explanation, so the picture
    confirms or refutes something they own rather than doing their thinking for them.
  • "must_show" — what becomes visible.
  • "must_manipulate" — what the student drags or slides, and what they watch SURVIVE or BREAK as they
    do. If nothing changes under manipulation it is a static diagram; reconsider whether it is earned.
  • "falsifies" — what they would SEE happen if the WRONG model were true. This is the field that
    separates a demonstration from decoration. If you cannot fill it honestly, drop the beat.
  • "form_hint" — exactly one of: construction | lattice | graph | transform | argand | field-3d | animated

checkpoints — 3-5, ordered, "id" numbered 1,2,3,... They are the spine: session completion is graded
against these and nothing else, so an unmeetable or unjudgeable checkpoint corrupts the record
permanently.
  • Each must be a DEMONSTRABLE ACT, visible in a chat transcript. BANNED: "understands", "knows",
    "appreciates", "is comfortable with", "is familiar with", "grasps", "is aware of" — these are
    internal states, and no reader of a transcript can grade them.
    BAD FORM:  "understands why the result holds"
    GOOD FORM: "states, before being shown, what happens to <quantity> when <parameter> changes, and
                gives the reason"
    GOOD FORM: "derives <result> unaided from <the assumption>, without being given the first step"
  • GRADER TEST: an independent reader holding only the transcript must be able to answer yes/no with
    no interpretation. If it needs interpretation, rewrite it.
  • Order by dependency: the first should be reachable early in a session; the last should sit at
    roughly the difficulty of the terminal transfer.
  • "evidence_type" — exactly one of: prediction | self_explanation | novel_application | derivation |
    calculation. Pick the one matching the ACT.
  • REQUIRED SPREAD: at least one checkpoint must be self_explanation or derivation (the why has to be
    demonstrated, not merely computed), and at least one must be novel_application (transfer). Without
    both, "complete" would mean nothing more than "answered some questions correctly".
  • Checkpoints are what the STUDENT does; they are not the derivation chain restated step by step.

terminal_transfer — the problem that certifies mastery.
  • "problem" — a specific, fully stated problem, including any setup or numbers needed to attempt it,
    solvable in one sitting at this level. Not "a hard problem about X".
  • It must be GENUINELY NON-TEMPLATED with respect to the derivation chain. THE FAILURE MODE: the
    last step of the chain with different numbers. To qualify, it must require at least one of: the
    student CHOOSING the tool from several plausible ones; running the chain BACKWARDS from a
    consequence to a cause; applying it in an unfamiliar configuration; or combining it with a
    prerequisite in a way the chain never demonstrated.
  • "why_novel" — name the specific move that pattern-matching cannot supply.
  • "acceptable_reasoning" — what a correct line of reasoning must CONTAIN (the load-bearing steps), so
    that reasoning can be graded rather than only a final answer. Not a full worked solution.

notation — only symbols this subtopic actually introduces, or that this board writes differently from
the common alternative. "read_as" is how it is spoken aloud. Empty array if nothing new is introduced.

common_dead_ends — 2-4 short strings. Where students stall PROCEDURALLY (as opposed to conceptually —
that is what misconceptions are for), each paired with the unstick, in the same string.

=== ANTI-PATTERNS: any of these means rewrite that field ===
  • A mechanism that restates its claim.
  • A step bottoming out at "it is a standard result" or at a later step's claim.
  • Two isomorphic cases from the same chapter with the objects renamed.
  • A checkpoint phrased as an internal state.
  • A terminal transfer that is the derivation's last step with new numbers.
  • A scene beat on a subtopic whose content is definitional, notational or purely procedural.
  • Any field containing instructions to the tutor about what to SAY, or in what ORDER.
  • Hedged filler ("it is important to note", "students should appreciate"). Every string does work.

=== FINAL CHECK BEFORE YOU EMIT ===
Re-read your own derivation_chain, covering each "claim" and asking whether the "mechanism" alone
would force it for someone who had never seen the claim. Re-read your checkpoints and ask whether you
could grade each one from a transcript with no interpretation. Re-read your two isomorphic cases and
ask whether a student would spot their sameness without abstracting — if so, replace one. Then return
the JSON object alone.`;

const userBrief = (id: PlanIdentity) => `Subject: ${id.subject || "(unspecified)"}
Level: ${id.level || "(unspecified)"}
Exam board: ${id.board || "(none / unbranded — use the mainstream treatment at this level)"}
Topic: ${id.topic || "(unspecified)"}
SUBTOPIC TO PLAN: ${id.subtopic}

Author the lesson plan for this subtopic now. Return the JSON object only.`;

// ---------------------------------------------------------------------------
// Model output handling
// ---------------------------------------------------------------------------

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Tolerates a stray fence or wrapper sentence — a recoverable formatting slip should not cost a retry. */
function parsePlanJson(content: string): unknown | null {
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
    } catch { /* genuinely unparseable — the caller retries */ }
  }
  return null;
}

/**
 * Quality checks the shared validator deliberately does not make.
 *
 * validateLessonPlan() is a SHAPE validator: its job is "can this be safely rendered", so it coerces
 * and drops rather than complains. That is right for the read path, where a thin plan still beats no
 * plan. Authoring is the one moment we can afford to be picky, so these structural bars are enforced
 * here — but only as retry feedback: a shape-valid plan that still trips one of these is stored
 * anyway, because degrading a usable plan to no plan at all would be the worse outcome.
 */
// Matches the state word only where it is the VERB of the checkpoint. Bare "familiar"/"aware" are
// left out on purpose: "applies it to an unfamiliar configuration" is a perfectly good checkpoint.
const INTERNAL_STATE = /\b(?:understands?|understanding\s+of|knows|appreciates?|grasps?|is\s+(?:comfortable|familiar|aware))\b/i;

// Stopwords are stripped before comparing, otherwise two short strings look similar merely for both
// being English. Measured over hand-written good/bad pairs across GCSE→undergrad maths and physics,
// this separates cleanly: genuine mechanisms scored ≤0.40, restatements and circular definitions 1.00.
const STOPWORDS = new Set([
  "the", "and", "that", "for", "with", "this", "its", "are", "was", "but", "not", "from", "into",
  "than", "then", "when", "which", "because", "since", "all", "any", "one", "have", "has", "had",
  "does", "will", "would", "must", "can", "their", "there", "each", "also", "only", "same", "such",
]);
const words = (s: string) =>
  new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
/** Fraction of the SHORTER string's content words also present in the longer one. */
function overlap(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

function qualityIssues(plan: LessonPlan): string[] {
  const issues: string[] = [];

  plan.derivation_chain.forEach((s, i) => {
    if (overlap(s.claim, s.mechanism) > 0.85) {
      issues.push(`derivation_chain[${i}].mechanism restates its claim instead of forcing it — give the process, inequality, symmetry or conservation principle that makes the claim unavoidable`);
    }
    if (!s.rests_on) issues.push(`derivation_chain[${i}].rests_on is empty — name the one load-bearing assumption`);
    if (!s.counterfactual) issues.push(`derivation_chain[${i}].counterfactual is empty — say what would happen instead if that assumption were dropped`);
    if (!s.bottoms_out_at) issues.push(`derivation_chain[${i}].bottoms_out_at is empty — name the axiom, definition or already-held concept it terminates in`);
  });

  if (plan.checkpoints.length < 3 || plan.checkpoints.length > 5) {
    issues.push(`checkpoints has ${plan.checkpoints.length} items — it must have 3 to 5`);
  }
  plan.checkpoints.forEach((c, i) => {
    if (INTERNAL_STATE.test(c.must_demonstrate)) {
      issues.push(`checkpoints[${i}].must_demonstrate describes an internal state ("${c.must_demonstrate}") — restate it as an act visible in a transcript`);
    }
  });
  if (!plan.checkpoints.some((c) => c.evidence_type === "self_explanation" || c.evidence_type === "derivation")) {
    issues.push("no checkpoint has evidence_type self_explanation or derivation — the why must be demonstrated, not only computed");
  }
  if (!plan.checkpoints.some((c) => c.evidence_type === "novel_application")) {
    issues.push("no checkpoint has evidence_type novel_application — without transfer, completion means nothing");
  }

  if (plan.isomorphic_cases.length !== 2) {
    issues.push(`isomorphic_cases has ${plan.isomorphic_cases.length} entries — it must have exactly 2, each with a setting AND a mapping`);
  } else if (plan.isomorphic_cases.some((c) => !c.mapping)) {
    issues.push("an isomorphic case is missing its mapping — name what plays which structural role in that setting");
  }
  if (!plan.shared_structure) {
    issues.push("shared_structure is empty — state the abstract structure the student must arrive at, in neither case's vocabulary");
  }

  // A beat pinned to a checkpoint that does not exist can never fire.
  plan.scene_beats.forEach((b, i) => {
    if (b.after_checkpoint > plan.checkpoints.length) {
      issues.push(`scene_beats[${i}].after_checkpoint is ${b.after_checkpoint} but there are only ${plan.checkpoints.length} checkpoints`);
    }
    if (!b.falsifies) {
      issues.push(`scene_beats[${i}].falsifies is empty — say what would be SEEN if the wrong model were true, or drop the beat entirely (an empty scene_beats array is a valid plan)`);
    }
  });

  if (!plan.terminal_transfer.why_novel) issues.push("terminal_transfer.why_novel is empty — name the move pattern-matching cannot supply");
  if (!plan.terminal_transfer.acceptable_reasoning) issues.push("terminal_transfer.acceptable_reasoning is empty — say what a correct line of reasoning must contain");

  return issues;
}

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const callerId = await requireUser(req);
  if (!callerId) return unauthorized(corsHeaders);

  try {
    const body = await req.json();
    const identity: PlanIdentity = {
      subject: body?.subject ?? null,
      level: body?.level ?? null,
      board: body?.board ?? null,
      topic: body?.topic ?? null,
      subtopic: body?.subtopic ?? null,
    };

    if (!hasPlanIdentity(identity)) {
      return json({ ok: false, errors: ["subtopic is required"] }, 400);
    }

    const signature = await planSignature(identity);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Fail CLOSED rather than authoring uncacheably. Without the cache every session would pay for
      // an authoring call, which inverts the entire economic argument for this layer; a plan-less
      // session is merely today's behaviour.
      console.error("SERVICE ROLE unavailable — refusing to author uncacheably");
      return json({ ok: false, errors: ["plan cache unavailable"] });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // --- Cache hit: the whole point of the layer. No AI call, no write. ---
    const { data: cachedRow, error: cacheErr } = await supabase
      .from("lesson_plans")
      .select("plan, model")
      .eq("signature", signature)
      .eq("plan_version", LESSON_PLAN_VERSION)
      .maybeSingle();
    if (cacheErr) console.error("lesson_plans lookup failed (will author):", cacheErr);
    if (cachedRow?.plan) {
      // Stored plans were validated before insert, but re-checking is free and means a row that
      // predates a contract change is re-authored rather than served broken.
      const revalidated = validateLessonPlan((cachedRow as { plan: unknown }).plan);
      if (revalidated.ok) {
        return json({
          ok: true,
          plan: revalidated.plan,
          signature,
          plan_version: LESSON_PLAN_VERSION,
          model: (cachedRow as { model: string | null }).model,
          fromCache: true,
        });
      }
      console.error("cached plan failed validation, re-authoring:", signature, revalidated.errors);
    }

    // --- Cache miss: author it. ---
    const ai = await getAIConfig("authoring");
    const messages: ChatMessage[] = [
      { role: "system", content: AUTHORING_SYSTEM_PROMPT },
      { role: "user", content: userBrief(identity) },
    ];

    let plan: LessonPlan | null = null;
    let lastErrors: string[] = [];
    // A shape-valid plan that only tripped the softer quality bars, held back in case the retry comes
    // back worse. The quality gate must never make the outcome worse than not having a quality gate.
    let secondBest: LessonPlan | null = null;

    // At most two attempts: the second is fed the SPECIFIC failures of the first. A third would be
    // paying frontier-model prices to fight a prompt that is not landing — better to return nothing
    // and let the session run plan-less than to spend more or, worse, store a half-plan.
    for (let attempt = 0; attempt < 2 && !plan; attempt++) {
      const res = await fetch(ai.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.model,
          messages,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("authoring AI error:", res.status, detail);
        lastErrors = [`authoring model returned ${res.status}`];
        break; // an upstream 402/429/5xx will not be fixed by re-sending the same request
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const parsed = parsePlanJson(content);

      const result = parsed === null
        ? { ok: false as const, errors: ["response was not valid JSON (it may have been cut short — keep every field, but keep every string tight)"] }
        : validateLessonPlan(parsed);

      if (result.ok) {
        const soft = qualityIssues(result.plan);
        if (soft.length === 0 || attempt === 1) {
          // Second time round a shape-valid plan is accepted even with residual quality issues —
          // logged so the breadth sweep can see which bars the prompt is failing to hold.
          if (soft.length) console.error("plan stored with residual quality issues:", signature, soft);
          plan = result.plan;
          break;
        }
        secondBest = result.plan;
        lastErrors = soft;
      } else {
        lastErrors = result.errors;
      }

      if (attempt === 0) {
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `That plan was REJECTED. Specific problems:\n${lastErrors.map((e) => `- ${e}`).join("\n")}\n\nFix exactly these and return the COMPLETE corrected JSON object — every field, not a patch and not a diff. Keep what was already good; do not restart from scratch. Same output rules: one JSON object, no fence, no commentary.`,
        });
      }
    }

    if (!plan && secondBest) {
      console.error("retry did not improve on the first plan, keeping it:", signature, lastErrors);
      plan = secondBest;
    }

    if (!plan) {
      // Nothing is written. A half-plan in the cache would be served to every future student of this
      // subtopic, so an empty cache slot is strictly the better failure.
      console.error("authoring failed for", signature, lastErrors);
      return json({ ok: false, errors: lastErrors.length ? lastErrors : ["authoring failed"] });
    }

    // Two sessions can reach a cache miss on the same subtopic at the same instant; both then author
    // and both write. Upserting on the signature makes that a harmless last-write-wins (the plans are
    // equivalent by construction) instead of a duplicate-key error on the loser.
    const { error: writeErr } = await supabase.from("lesson_plans").upsert(
      {
        signature,
        plan_version: LESSON_PLAN_VERSION,
        subject: identity.subject || null,
        level: identity.level || null,
        board: identity.board || null,
        topic: identity.topic || null,
        subtopic: identity.subtopic || null,
        plan,
        model: ai.model,
      },
      // Must match the table's UNIQUE (signature, plan_version): uniqueness is per subtopic PER
      // VERSION, so that bumping LESSON_PLAN_VERSION adds a plan beside its predecessor instead of
      // destroying it. Naming only `signature` here would not match any constraint and the upsert
      // would fail outright.
      { onConflict: "signature,plan_version" },
    );
    // A failed write costs the next caller another authoring call; it must never cost THIS caller its
    // plan, which is already valid in hand.
    if (writeErr) console.error("lesson_plans upsert failed (returning plan uncached):", writeErr);

    return json({
      ok: true,
      plan,
      signature,
      plan_version: LESSON_PLAN_VERSION,
      model: ai.model,
      fromCache: false,
      persisted: !writeErr,
    });
  } catch (e) {
    console.error("author-lesson-plan error:", e);
    return json({ ok: false, errors: [e instanceof Error ? e.message : "Unknown error"] }, 500);
  }
});
