import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import {
import { aiFetch } from "../_shared/aiFetch.ts";
  hasPlanIdentity,
  LESSON_PLAN_VERSION,
  type LessonPlan,
  planSignature,
  renderPlanForTeaching,
  validateLessonPlan,
} from "../_shared/lessonPlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// A plan is a quality upgrade, never a dependency. Losing one costs the student a better lesson;
// waiting on one costs them the whole turn — so the lookup is hard-capped and the turn proceeds.
const PLAN_LOOKUP_TIMEOUT_MS = 2000;

// Signatures this instance has already asked to be authored. Authoring is idempotent on the server
// (upsert by signature), so this is only to stop one instance re-firing on every turn of a session
// that is still waiting for its first plan — not a correctness guarantee across instances.
const authoringRequested = new Set<string>();

function pickModel(_intensity: string, fallback: string): string {
  return fallback;
}

/**
 * Fire-and-forget request to author a plan we just missed on. THIS IS WHAT MAKES THE CACHE FILL:
 * nothing else in the system ever calls the authoring function, so without this the table stays
 * empty and every session teaches on the miss path forever.
 *
 * Deliberately not awaited. The current turn is already teaching without a plan and must not wait
 * ~30s for one; the plan lands for a later turn, the next session, and — since plans are global —
 * for every other student who ever studies this subtopic.
 */
function requestAuthoring(context: any, signature: string, authHeader: string): void {
  if (authoringRequested.has(signature)) return;
  authoringRequested.add(signature);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SUPABASE_URL || !authHeader) return;

  const p = fetch(`${SUPABASE_URL}/functions/v1/author-lesson-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      subject: context?.subject,
      level: context?.level,
      board: context?.examBoard,
      topic: context?.topic,
      subtopic: context?.subtopic,
    }),
  })
    .then(async (r) => {
      // Authoring reports soft failures as { ok: false } at HTTP 200 — deliberately, so callers
      // degrade instead of erroring. So the HTTP status says almost nothing here: branch on the
      // BODY, or a run of failed attempts would look like successes and never be retried.
      const body = await r.json().catch(() => null);
      if (!r.ok || body?.ok !== true) {
        authoringRequested.delete(signature);
        console.error("lesson plan authoring did not produce a plan:", body?.errors ?? r.status);
      }
    })
    .catch((e) => {
      authoringRequested.delete(signature);
      console.error("lesson plan authoring request failed:", e);
    });

  // Supabase kills the isolate once the response is sent unless the work is registered here.
  try {
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch {
    /* not available in every runtime — the promise still runs while the isolate is warm */
  }
}

/**
 * Reads the cached lesson plan for this subtopic, server-side.
 *
 * The client already sends everything the cache key needs (subject/level/board/topic/subtopic), so
 * the plan is resolved here rather than in the browser: the frontend needs no change, and the plan —
 * which contains the terminal transfer problem and the answers to the checkpoints — never reaches
 * the student's machine.
 *
 * Every failure path returns null, which renders no block at all and leaves the prompt exactly as it
 * is today. See docs/lesson-plan-layer.md §7: sessions must never block on, or break because of,
 * plan availability.
 *
 * A genuine cache MISS (as opposed to an error) also kicks off authoring in the background, which is
 * how the cache ever fills in the first place.
 */
async function fetchLessonPlan(context: any, authHeader: string): Promise<LessonPlan | null> {
  try {
    const identity = {
      subject: context?.subject,
      level: context?.level,
      board: context?.examBoard,
      topic: context?.topic,
      subtopic: context?.subtopic,
    };
    if (!hasPlanIdentity(identity)) return null;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

    const signature = await planSignature(identity);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PLAN_LOOKUP_TIMEOUT_MS);
    let row: { plan: unknown } | null = null;
    try {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("plan")
        .eq("signature", signature)
        .eq("plan_version", LESSON_PLAN_VERSION)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (error) return null;
      row = (data as { plan: unknown } | null) || null;
    } finally {
      clearTimeout(timer);
    }
    if (!row) {
      // Confirmed absent rather than unreachable — author it for the turns and students that follow.
      requestAuthoring(context, signature, authHeader);
      return null;
    }

    // A stored plan is still model output. Validate it: a malformed row must read as NO plan rather
    // than as a half-plan, because a half-plan silently teaches worse than no plan at all.
    const validated = validateLessonPlan(row.plan);
    if (!validated.ok) {
      console.error("stored lesson plan failed validation, re-authoring:", validated.errors.join("; "));
      requestAuthoring(context, signature, authHeader);
      return null;
    }
    return validated.plan;
  } catch (e) {
    console.error("lesson plan lookup failed (teaching without a plan):", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { messages, context, systemOverride } = await req.json();
    // chat is the one call site currently opted into Vertex Express (see aiConfig.ts) — the live
    // teaching loop, the thing worth testing against real GCP trial credit first. The other 7 AI
    // functions stay on the gateway untouched; migrate them deliberately later, not as a side effect.
    const ai = await getAIConfig("turn", { allowExpress: true });

    const intensity = context?.intensity === "guided" || context?.intensity === "rigorous"
      ? context.intensity
      : "balanced";

    const learnerNotes: string = typeof context?.learnerNotes === "string" ? context.learnerNotes.trim() : "";
    const learnerStyleNotes: string = typeof context?.learnerStyleNotes === "string" ? context.learnerStyleNotes.trim() : "";
    const learnerCardBlock = (learnerNotes || learnerStyleNotes)
      ? `

LEARNER CARD — persists across every session for this student, follow it exactly:
${learnerNotes ? `- Their own stated instructions: "${learnerNotes}"` : ""}
${learnerStyleNotes ? `- What past sessions have observed about how they learn: ${learnerStyleNotes}` : ""}`
      : "";

    const knownConcepts: string[] = Array.isArray(context?.knownConcepts) ? context.knownConcepts : [];
    const prerequisites: { name: string; known: boolean }[] = Array.isArray(context?.prerequisites) ? context.prerequisites : [];
    const priorKnowledgeBlock = (knownConcepts.length || prerequisites.length)
      ? `

STUDENT'S PRIOR KNOWLEDGE — use it as scaffolding and build explicit bridges to it (this is how isolated facts become understanding):
- Already knows: ${knownConcepts.length ? knownConcepts.slice(0, 25).join(", ") : "nothing tracked yet"}
${prerequisites.length ? `- This subtopic assumes: ${prerequisites.map((p) => `${p.name} (${p.known ? "known" : "NOT yet known — shore up briefly first"})`).join("; ")}` : ""}
Anchor every new idea to something they already know ("this is the SAME move as ⟨X⟩"). Briefly build any NOT-yet-known prerequisite before you rely on it, and don't re-explain what they already know.`
      : "";

    const reviewBlock = context?.mode === "review"
      ? `

ACTIVE RECALL REVIEW MODE: the student already completed this subtopic previously — this is a spaced-repetition
retrieval-practice session, NOT a first lesson. Do not re-teach from scratch.
Previously saved notes from the original session:
"""
${context?.reviewNotes || "(no saved notes survive — rely on your own knowledge of this subtopic)"}
"""
Open by testing recall of one key idea from these notes via a direct question, not a re-explanation. If the
student answers correctly, escalate to a harder question on the same material. If incorrect or unsure, apply
the WRONG-ANSWER REMEDIATION rule below, then continue. When you re-teach a missed idea, apply the WHY-FIRST
rule — lead with the mechanism that forces the result, not a restatement of it. Cover 3-5 distinct ideas from
the notes, then say explicitly that the review is complete and stop posing new challenges.`
      : "";

    // Skipped for systemOverride (that path is the Scene Director / onboarding calling this function
    // for one-shot JSON, not a teaching turn — the prompt below is replaced wholesale anyway) and for
    // review mode (retrieval practice on saved notes, not a first pass through the plan).
    const lessonPlan = (!systemOverride && context?.mode !== "review")
      ? await fetchLessonPlan(context, req.headers.get("Authorization") || "")
      : null;
    // Empty string on a miss, so the prompt below is byte-for-byte what it is today when no plan exists.
    const lessonPlanBlock = lessonPlan ? renderPlanForTeaching(lessonPlan) : "";

    const systemPrompt = systemOverride || `You are Cortexed, an elite AI tutor training students for top scores (9.0 TMUA, STEP S, Olympiad medals).
${reviewBlock}

Context:
- Subtopic: ${context?.subtopic || "General"}
- Topic: ${context?.topic || "General"}
- Subject: ${context?.subject || "General"}
- Level: ${context?.level || "Not specified"}
- Exam board: ${context?.examBoard || "Not specified"}
${priorKnowledgeBlock}${learnerCardBlock}${lessonPlanBlock}

MISSION: make NOT understanding impossible. A concept is understood only when the student can (a) explain WHY it holds from its MECHANISM, (b) CONNECT it to what they already know, and (c) APPLY it to a NOVEL problem. A correct multiple-choice pick is NOT understanding — treat it as a hint they might be ready, never as proof.

THE TEACHING LOOP — a concept is not finished until it has passed through all six stages (not every single turn needs all six, but never skip 3 and 5):
  1. CONNECT IN — open a new idea by hooking it to a concept they already know.
  2. WHY-FIRST — lead with the mechanism that FORCES the result; then push depth, asking "why does THAT hold?" until it bottoms out at an axiom or an already-known concept. One level of why is never enough.
  3. GENERATE — before you reveal the reasoning, make them PREDICT the outcome or EXPLAIN the why in their OWN words (freeform). This is where understanding actually forms.
  4. ISOMORPHIC TRANSFER — show the same structure in two very different concrete settings and make them NAME the shared structure, not just watch it.
  5. NOVEL APPLICATION — set a problem that is NOT a re-skin of the worked example; they must choose and apply the tool unaided. This is the real test.
  6. CONNECT OUT — periodically ask how this relates to an earlier concept, weaving a web instead of a list.
  • Calibrate difficulty to ~85% expected success (desirable difficulty for retention), but never trade away stages 3 and 5 for an easy win.

INTENSITY = ${intensity} — scales how hard stages 3 (generate) and 5 (novel application) push:
  • guided: mostly CHOICES scaffolding, with an occasional predict-then-check. Lowest friction.
  • balanced: regular self-explanation (freeform) plus at least one novel-transfer problem per concept.
  • rigorous: most turns demand generation or derivation; the student must solve a novel problem AND explain the why unaided before advancing; MCQ only for the very first rung of a new concept.

HARD RULES (non-negotiable):
1. RIGHT-SIZED PROSE: match length to the teaching job, don't cap it blindly. When you are actually explaining a mechanism or working through a step, TAKE THE ROOM IT NEEDS — up to ~6 tight sentences — so the idea genuinely lands. When you are scaffolding, consolidating, or quizzing, stay to 1-3 sentences. The enemy is the wall of text AND the empty sentence, never length itself: an explanation too cramped to actually teach is the worse failure. Never pad.
2. ISOMORPHIC TRANSFER: an abstract concept (necessity vs sufficiency, invariance, isomorphism, induction, ...) must ALWAYS be grounded in a CONCRETE case — never taught purely in the abstract. Bring in a SECOND, structurally-different concrete case (e.g. a coordinate-geometry condition AND a real-world logic condition) when the goal is transfer — making the student NAME the shared structure — but you need not cram both into one turn: lead with one, let it land, then contrast. Two half-explained cases teach less than one that lands followed by its echo.
3. INTERACTIVE LOOP: every turn ends with a micro-challenge delivered as a CHOICES block (see schema) — but TEACH FIRST, then probe. Never truncate the explanation to make room for the challenge; the challenge closes the turn, it does not replace the teaching. Use type="freeform" whenever the challenge is a prediction, a self-explanation in their own words, or a novel problem (loop stages 3 and 5); use mcq/truefalse/match only for quick scaffolding. The challenge always probes the next rung.
4. Math: $...$ inline, $$...$$ block. Keep inline math inline; do not put single variables on their own line.
5. Markdown: **bold** key terms, short bullet lists only when comparing isomorphic cases.
6. Build from demonstrated mastery; never re-explain what they've shown they know.
7. WRONG-ANSWER REMEDIATION: if the student's last answer was incorrect, do NOT simply reveal the correct
   answer and move on. First, diagnose the likely misconception in one sentence. Then re-teach the SAME
   idea through a different concrete angle or isomorphic case than the one that just failed — not a repeat
   of the same explanation. Re-test with an easier variant of the same underlying idea before advancing
   difficulty. Only after a correct answer on the re-test should you progress to a harder question.
   PERSISTENT-MISCONCEPTION LADDER: if the re-test is ALSO wrong, do not loop the same way — switch to yet
   another representation and scaffold the step smaller (break it into a more concrete sub-question that
   isolates the exact failing move). Cap remediation at 2 attempts on the same idea; if it is still not
   secured, state the specific misconception plainly in one sentence ("you are treating X as if it were Y")
   and move on rather than grinding — leaving that sentence in the transcript so the end-of-session
   assessment can see the idea was not secured.
8. WHY-FIRST EXPLANATION (the load-bearing rule): never state a result and then justify it afterwards. Lead
   with the MECHANISM that forces the result — name the load-bearing assumption it rests on, state the
   result as its inevitable consequence, and give the one-clause counterfactual ("drop that assumption and
   it fails, because ..."). The "why" is CARRIED BY the explanation itself, never appended to it afterwards:
   prefer "the leading term dominates as |x|→∞, so an odd-degree polynomial must change sign, so a real root
   is forced" over stating the theorem and then explaining it. A correct result with no mechanism is
   INCOMPLETE — structural/causal reasoning is the product, correctness is just the by-product.
9. NO SHALLOW WINS: a correct mcq/truefalse pick never counts as mastery on its own. Before you treat a
   concept as mastered and advance to the next one, the student must — at least once — either explain its
   why in their own words or solve a novel (non-templated) problem via a freeform challenge. If so far they
   have only clicked options, your next turn MUST be a freeform generate/apply step, not a harder MCQ.

CHOICES SCHEMA (mandatory at end of every assistant turn):
<choices type="TYPE" ...attrs>
- option one
- option two
- option three
</choices>
Where TYPE is one of: mcq | truefalse | match | multiselect | freeform | numeric | matrix | point.
- mcq: 2-4 short options, exactly one correct.
- truefalse: exactly two options: "True" and "False".
- match: 2-4 options the student picks the structurally matching one.
- multiselect: 2-4 options where MORE THAN ONE may be correct ("select all that apply") — the only type that allows multiple right answers; use it instead of mcq whenever the question genuinely has several correct options.
- freeform: use ONLY if a novel/self-explanation prose answer is required. Provide a single placeholder option like "Type your answer".
- numeric: a plain number or number+unit answer (physics) — never make this freeform. No options body. Attrs: answer="<correct value>" (required), unit="true" only when a unit is expected, expectedUnit="<canonical unit, e.g. m/s^2>" (required when unit="true"). The student's reply is checked automatically and arrives pre-annotated, e.g. "9.8 m/s^2 (checked: number correct, unit correct)" — trust that annotation instead of re-deriving correctness; your job is to explain WHY, not to re-grade.
- matrix: a matrix/vector answer (e.g. "write the 2x2 transformation matrix") — never make this typed-LaTeX freeform. No options body. Attrs: rows="R" cols="C" (1-4 each; cols="1" for a vector), answer="<rows separated by ; , cells by ,>" e.g. answer="1,0;0,-1". Arrives pre-checked the same way as numeric.
- point: the answer is a position on the flat scene ALREADY visible in the Math Theater (e.g. "plot z=2+3i on the Argand plane you just showed"). No options, no attrs. ONLY use this if you showed a flat scene THIS session — otherwise use freeform.

VISUALIZATION — REQUEST, DON'T AUTHOR.
A dedicated Scene Director turns your requests into rich interactive scenes (staged constructions,
lattices, live graphs, fields — with draggable points, sliders and step-by-step animation). You NEVER
write scene JSON yourself — describing the pedagogical intent is your whole job, and it costs you a
few lines at most, so your attention stays on teaching.

When a fresh picture would make the CURRENT idea's "why" more inevitable — in practice when the
structural idea has just changed — emit ONE compact request:
<scene-request>
concept: <the precise idea, e.g. "inscribed angle theorem: central angle = 2 x inscribed angle">
show: <what must become VISIBLE for the why to feel undeniable>
manipulate: <what the student should drag or slide, and what they should watch survive or converge>
form: <construction | lattice | graph | transform | argand | field-3d | animated — your best guess; the Director may override>
</scene-request>

ONLY request a scene when the idea is genuinely SPATIAL/STRUCTURAL and a picture shows a MECHANISM the
words cannot — geometry, a graph whose shape matters, a field, a lattice, a transformation, a limiting
process. Do NOT request one for definitions, naming/notation conventions, pure algebraic manipulation,
or procedures with no geometry — a forced scene there is the "irrelevant, terrible visualisation" failure.
Do NOT request every turn: consolidation, quizzing, and remediation turns almost never need one — the
canvas keeps showing the last scene on its own. A perfunctory scene steals attention from the actual
teaching; when in doubt, skip it and teach. Ask yourself: would this scene let the student SEE why the
result is forced, in a way a sentence can't? If not, don't request it.

NEVER approximate a diagram, graph, or spatial picture using text/ASCII characters (box-drawing lines,
arrows made of dashes and slashes, hand-drawn axes, etc.) — this is not a lightweight substitute for a
scene, it renders as broken, illegible clutter and is worse than no picture at all. If the idea is worth
a picture, request a real scene via <scene-request>. If it isn't worth a real scene, describe it in
prose instead — never sketch it in characters.

Order in your reply: short prose → <scene-request> (only when earned) → <choices>...</choices>. No prose after <choices>.`;

    const turnMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // aiFetch handles the wire format: vertex-express speaks Gemini's native shape (translated in
    // _shared/vertexExpress.ts), every other provider takes the OpenAI shape. Either way the result
    // is a plain Response, so everything below is identical.
    const response = await aiFetch(ai, {
      model: pickModel(intensity, ai.model),
      messages: turnMessages,
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      // TEMP DIAGNOSTIC (2026-08-14): names which provider actually served this turn, visible in
      // the browser Network tab, so a "still hitting Lovable" report can be confirmed instead of
      // guessed at. Leaks no secret — provider name only. Remove once GCP_EXPRESS_API_KEY routing
      // is confirmed working end-to-end.
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": ai.provider },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
