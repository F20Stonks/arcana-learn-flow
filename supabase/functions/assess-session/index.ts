import { getAIConfig, getAIConfigSync } from "../_shared/aiConfig.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import {
  hasPlanIdentity,
  LESSON_PLAN_VERSION,
  type LessonPlan,
  planSignature,
  renderPlanForAssessment,
  validateLessonPlan,
} from "../_shared/lessonPlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_INTERVAL_DAYS = 3;
const MAX_INTERVAL_DAYS = 365;
const REVIEW_GROWTH: Record<"low" | "medium" | "high", number> = { low: 1.3, medium: 1.6, high: 2.5 };
const REVIEW_LAPSE_FACTOR = 0.4;
const MAX_LEARNER_OBSERVATIONS = 5;

type ExtractedConcept = { name: string; type?: string; definition?: string; aliases?: string[] };
type ConceptRow = { id: string; name: string; type: string; definition: string | null; aliases: string[] | null };

const VALID_TYPES = new Set(["notation", "terminology", "skill"]);
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const formsOf = (c: { name: string; aliases?: string[] | null }) =>
  [c.name, ...(c.aliases || [])].map(norm).filter(Boolean);

const tokens = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
function jaccard(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

async function resolveConcepts(
  supabase: ReturnType<typeof createClient>,
  taught: ExtractedConcept[],
  required: ExtractedConcept[],
): Promise<Map<string, string>> {
  const ai = getAIConfigSync();
  const resolved = new Map<string, string>();

  const specs = new Map<string, ExtractedConcept>();
  for (const c of [...taught, ...required]) {
    const k = norm(c.name);
    if (!k) continue;
    if (!specs.has(k)) {
      specs.set(k, {
        name: c.name.trim(),
        type: VALID_TYPES.has((c.type || "").toLowerCase()) ? (c.type as string).toLowerCase() : "terminology",
        definition: (c.definition || "").trim(),
        aliases: (c.aliases || []).map((a) => a.trim()).filter(Boolean),
      });
    }
  }
  if (specs.size === 0) return resolved;

  const { data: existingRaw } = await supabase.from("concepts").select("id, name, type, definition, aliases");
  const existing = (existingRaw || []) as ConceptRow[];

  const toCreate: ExtractedConcept[] = [];
  const ambiguous: { key: string; spec: ExtractedConcept; candidates: ConceptRow[] }[] = [];

  for (const [key, spec] of specs) {
    const specForms = new Set(formsOf(spec));
    const exact = existing.find((c) => formsOf(c).some((f) => specForms.has(f)));
    if (exact) {
      resolved.set(key, exact.id);
      continue;
    }
    const candidates = existing
      .map((c) => ({ c, s: Math.max(jaccard(spec.name, c.name), ...(c.aliases || []).map((a) => jaccard(spec.name, a)), 0) }))
      .filter((x) => x.s >= 0.34)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.c);
    if (candidates.length === 0) toCreate.push(spec);
    else ambiguous.push({ key, spec, candidates });
  }

  if (ambiguous.length > 0) {
    try {
      const payload = ambiguous.map((a, i) => ({
        index: i,
        concept: { name: a.spec.name, type: a.spec.type, definition: a.spec.definition },
        candidates: a.candidates.map((c) => ({ id: c.id, name: c.name, definition: c.definition })),
      }));
      const res = await fetch(ai.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            {
              role: "system",
              content: `You deduplicate a GLOBAL concept registry. For each item you get an extracted concept and a shortlist of EXISTING concepts it might duplicate. Decide, per item, LINK vs CREATE:
- Same concept (same meaning, even if worded/notated differently) → LINK: return that concept's id.
- No candidate means the same thing → CREATE.
- AMBIGUOUS/unsure → default to LINK to the closest candidate. A wrong merge is recoverable; a wrong new row silently fragments the registry.
Respond ONLY with JSON: {"decisions":[{"index":number,"concept_id":string|null,"create":boolean}]}. When create is true, concept_id must be null.`,
            },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        const decisions: { index: number; concept_id: string | null; create: boolean }[] = parsed.decisions || [];
        for (const d of decisions) {
          const item = ambiguous[d.index];
          if (!item) continue;
          if (!d.create && d.concept_id && item.candidates.some((c) => c.id === d.concept_id)) {
            resolved.set(item.key, d.concept_id);
          } else {
            toCreate.push(item.spec);
          }
        }
        for (const item of ambiguous) {
          if (!resolved.has(item.key) && !toCreate.includes(item.spec)) {
            resolved.set(item.key, item.candidates[0].id);
          }
        }
      } else {
        for (const item of ambiguous) resolved.set(item.key, item.candidates[0].id);
      }
    } catch (e) {
      console.error("reconcile failed, defaulting ambiguous to LINK:", e);
      for (const item of ambiguous) if (!resolved.has(item.key)) resolved.set(item.key, item.candidates[0].id);
    }
  }

  for (const spec of toCreate) {
    const key = norm(spec.name);
    if (resolved.has(key)) continue;
    const { data: created, error } = await supabase
      .from("concepts")
      .insert({ name: spec.name, type: spec.type, definition: spec.definition || null, aliases: spec.aliases || [] })
      .select("id")
      .single();
    if (!error && created) resolved.set(key, (created as { id: string }).id);
    else console.error("concept create failed:", spec.name, error);
  }

  return resolved;
}

type SpecItemRow = {
  id: string; text: string; rigor: string; evidence_requirements: string[]; subtopic_ids: string[]; ticked: boolean;
};

async function tickMatchingSpecItems(
  supabase: ReturnType<typeof createClient>,
  subtopicId: string,
  messages: { role: string; content: string }[],
) {
  const ai = getAIConfigSync();
  const { data: itemsRaw } = await supabase
    .from("spec_checklist_items")
    .select("id, text, rigor, evidence_requirements, subtopic_ids, ticked")
    .contains("subtopic_ids", [subtopicId])
    .eq("ticked", false);
  const items = (itemsRaw || []) as unknown as SpecItemRow[];
  if (items.length === 0) return;

  const allSubIds = [...new Set(items.flatMap((i) => i.subtopic_ids))];
  const { data: subs } = await supabase.from("subtopics").select("id, status").in("id", allSubIds);
  const statusById = new Map(((subs || []) as { id: string; status: string }[]).map((s) => [s.id, s.status]));
  const fullyCovered = items.filter((i) => i.subtopic_ids.every((id) => statusById.get(id) === "complete"));
  if (fullyCovered.length === 0) return;

  const simple = fullyCovered.filter((i) => i.rigor !== "complex");
  const complex = fullyCovered.filter((i) => i.rigor === "complex");

  const toTick: string[] = simple.map((i) => i.id);

  if (complex.length > 0) {
    const transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const payload = complex.map((i, idx) => ({ index: idx, requirement: i.text, evidenceRequirements: i.evidence_requirements }));
    try {
      const res = await fetch(ai.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            {
              role: "system",
              content: `You check a session transcript against specification requirements that each bundle multiple distinct pieces of evidence. For EACH requirement, decide if the transcript shows ALL of its "evidenceRequirements" were genuinely demonstrated (not just mentioned in passing) — be strict, a requirement naming a derivation needs the derivation actually shown, not just the result stated. Respond ONLY with JSON: {"results":[{"index":number,"satisfied":boolean}]}`,
            },
            { role: "user", content: `Requirements:\n${JSON.stringify(payload)}\n\nSession transcript:\n${transcript}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        const results: { index: number; satisfied: boolean }[] = parsed.results || [];
        for (const r of results) {
          if (r.satisfied && complex[r.index]) toTick.push(complex[r.index].id);
        }
      }
    } catch (e) {
      console.error("complex spec item check failed (leaving unticked):", e);
    }
  }

  if (toTick.length > 0) {
    await supabase.from("spec_checklist_items").update({ ticked: true, ticked_at: new Date().toISOString() }).in("id", toTick);
  }
}

/** PostgREST returns a many-to-one embed as an object, but some shapes come back wrapped in a
 * one-element array. Normalise both rather than depend on which. */
function embedded<T>(v: unknown): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? (v[0] as T) : (v as T)) || null;
}

/**
 * Resolves the same globally-cached lesson plan the teaching turns used, from the subtopic id.
 *
 * The cache key is built from exactly the fields the client sends `chat` (subtopic/topic title,
 * track subject/level/exam_board), read back out of the tables here — so the assessment grades
 * against the very plan the tutor was teaching from, without widening the request contract.
 *
 * Every failure returns null, which leaves the rubric below exactly as it is today.
 */
async function fetchLessonPlanForSubtopic(
  supabase: ReturnType<typeof createClient>,
  subtopicId: string,
): Promise<LessonPlan | null> {
  try {
    const { data, error } = await supabase
      .from("subtopics")
      .select("title, topics(title, learning_tracks(subject, level, exam_board))")
      .eq("id", subtopicId)
      .maybeSingle();
    if (error || !data) return null;

    const topic = embedded<{ title: string; learning_tracks: unknown }>((data as any).topics);
    const track = embedded<{ subject: string; level: string | null; exam_board: string | null }>(
      topic?.learning_tracks,
    );
    const identity = {
      subject: track?.subject,
      level: track?.level,
      board: track?.exam_board,
      topic: topic?.title,
      subtopic: (data as any).title,
    };
    if (!hasPlanIdentity(identity)) return null;

    const signature = await planSignature(identity);
    const { data: planRow, error: planErr } = await supabase
      .from("lesson_plans")
      .select("plan")
      .eq("signature", signature)
      .eq("plan_version", LESSON_PLAN_VERSION)
      .maybeSingle();
    if (planErr || !planRow) return null;

    // A stored plan is still model output — a malformed row must grade as NO plan (today's rubric),
    // never as a partial bar that could pass a session on half the checkpoints.
    const validated = validateLessonPlan((planRow as any).plan);
    return validated.ok ? validated.plan : null;
  } catch (e) {
    console.error("lesson plan lookup failed (assessing on the general rubric):", e);
    return null;
  }
}

/**
 * The ids the model claims were demonstrated, restricted to ids the plan actually defines.
 *
 * Returns null when the field is ABSENT rather than empty. That distinction is load-bearing: an
 * empty array is a judgement ("none were demonstrated") and must gate completion, whereas a missing
 * field is a FORMATTING failure by the model and says nothing about the student. Collapsing the two
 * would let one dropped field cost a student their notes, concepts, XP and review schedule — all of
 * which hang off `complete` below — for work they actually did.
 */
function metCheckpointIds(raw: unknown, validIds: number[]): number[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = new Set(validIds);
  return [...new Set(raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && valid.has(n)))].sort(
    (a, b) => a - b,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const callerId = await requireUser(req);
  if (!callerId) return unauthorized(corsHeaders);

  const fallback = { complete: false, confidence: "low", notes_to_save: [], xp_earned: 10, concepts_taught: [], concepts_required: [] };

  try {
    const { sessionId, subtopicId, messages, intensity: rawIntensity } = await req.json();
    await getAIConfig();
    const ai = getAIConfigSync();

    const intensity = rawIntensity === "guided" || rawIntensity === "rigorous" ? rawIntensity : "balanced";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;
    if (!supabase) console.error("SERVICE ROLE unavailable — assessment will return but no knowledge will be persisted");

    let userId: string | null = null;
    let realSubtopicId: string | null = subtopicId || null;
    let sessionType = "learn";
    if (supabase && sessionId) {
      const { data: sess } = await supabase.from("sessions").select("user_id, subtopic_id, session_type").eq("id", sessionId).maybeSingle();
      if (sess) {
        if ((sess as any).user_id !== callerId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = (sess as any).user_id;
        realSubtopicId = (sess as any).subtopic_id || realSubtopicId;
        sessionType = (sess as any).session_type || "learn";
      }
    }
    const isReview = sessionType === "review";

    // Learn sessions only: `chat` deliberately withholds the plan in review mode, so a review
    // transcript was never produced against these checkpoints — grading it against a bar the tutor
    // was never given would fail sessions for material the review was never asked to cover.
    const plan = (supabase && realSubtopicId && !isReview)
      ? await fetchLessonPlanForSubtopic(supabase, realSubtopicId)
      : null;
    // Both are "" without a plan, so the prompt is byte-for-byte today's when none exists.
    const planBlock = plan ? `${renderPlanForAssessment(plan)}\n` : "";
    const planCompletionRule = plan
      ? `\n- CHECKPOINTS: every checkpoint listed above was demonstrated in the transcript. This is IN ADDITION to the requirements below, never instead of them — an unmet checkpoint means NOT complete no matter how strong the rest of the transcript is.`
      : "";
    const planJsonFields = plan
      ? `,\n  "checkpoints_met": number[],\n  "checkpoints_unmet": number[]`
      : "";

    const systemPrompt = `You are the assessment engine for an elite tutoring session (targets: 9.0 TMUA, STEP S, Olympiad medals). You read the FULL transcript of ONE session and return a strict JSON verdict. Be rigorous and repeatable — apply the rubrics literally. Do NOT award completion or XP for effort alone.
${isReview ? `\nThis is an ACTIVE-RECALL REVIEW session: the transcript tests recall of previously-learned material, it does not teach anything new. "complete" here means the student successfully recalled the material across the review's challenges. Leave "concepts_taught" and "concepts_required" as empty arrays (nothing new is taught in a review).\n` : ""}
${planBlock}COMPLETION RUBRIC — set "complete": true ONLY if ALL of these hold:${planCompletionRule}
- TRANSFER: the student solved at least one NOVEL problem (not a re-skin of a worked example) substantially unaided.
- SELF-EXPLANATION: the student articulated the WHY — the mechanism that forces the result — in their OWN words (a freeform answer), not merely by picking correct options.
- They reached and answered the session's hardest / terminal challenge correctly.
- Every wrong answer was remediated to a correct re-test; no misconception remains unresolved at the end.
A transcript that is ONLY correct multiple-choice picks — no freeform self-explanation, no novel problem solved unaided — is NOT complete, however many were right. A session that only covered easy rungs, or ended on a wrong/uncertain answer, is NOT complete.

INTENSITY of this session was "${intensity}". This scales CONFIDENCE, not the completion bar — the transfer + self-explanation requirements hold in every mode (the tutor forces at least one freeform generate/apply step per concept even on "guided"). Hold "rigorous" transcripts to abundant unaided derivation; "guided" transcripts show the minimum evidence.

CONFIDENCE:
- "high": novel problem solved unaided AND the mechanism explained in the student's own words, at the hardest rung (typical of "rigorous").
- "medium": the completion bar was met but on thinner evidence, or via one shaky recovery (cap "guided" sessions here even when complete).
- "low": mostly multiple-choice hits with little evidence of independent understanding.

XP RUBRIC (integer 10-100, be deterministic; reward UNDERSTANDING, not clicks):
- Base by hardest difficulty genuinely reached: easy rung = 20, intermediate = 40, advanced/proof = 60, terminal-hardest = 75.
- +15 if the student solved a NOVEL problem unaided (transfer).
- +10 if they explained a WHY in their own words (self-explanation).
- +10 if they recovered from a wrong answer to a correct re-test (productive struggle).
- If the transcript is only multiple-choice picks with no freeform reasoning, cap the total at 40 (shallow).
- -15 if abandoned early / ended incomplete (still award for what was shown).
- Clamp to [10, 100].

NOTES ("notes_to_save", 1-4 objects {title, content}): each "content" must capture the STRUCTURAL/CAUSAL takeaway — the mechanism, the load-bearing assumption, the counterfactual — NOT "we learned about X". Write them as durable revision notes the student can be quizzed on later. Math in "content" MUST use LaTeX delimiters — $...$ inline, $$...$$ block — exactly like the transcript itself (e.g. "the discriminant $b^2-4ac$", never "b^2-4ac" or "b²-4ac" as bare text). This is a real typesetting pipeline (KaTeX), not markdown-viewed-as-plaintext — undelimited notation renders as raw, uneven text instead of a proper equation.

LEARNER OBSERVATIONS ("learner_observations", array of strings, [] if nothing notable — do NOT force a fixed count): zero or more one-sentence observations capturing something durable about HOW this student learns, distinct from what they now know — e.g. a recurring misconception, a representation that clicked (geometric/algebraic/physical), a notation habit, or a pacing signal. Each must generalize beyond this one subtopic — skip anything true only of this specific problem. Return [] if nothing durable and new showed up in this transcript; return several if the session genuinely revealed several distinct things. This feeds a persistent profile the tutor reads every future session.
${isReview ? "" : `
CONCEPT EXTRACTION (feeds a permanent GLOBAL knowledge tracker — be precise):
- "concepts_taught": atomic concepts this session actually TAUGHT and the student demonstrated understanding of (only include a concept if the transcript shows they grasped it).
- "concepts_required": atomic concepts the session ASSUMED the student already knew (prerequisites), not taught here.
- Each concept: { "name": canonical concise name, "type": "notation" | "terminology" | "skill", "definition": one precise sentence (a good future search target), "aliases": [alternative names/notations, may be empty] }.
- "name" must be canonical and reusable across subjects (shared global vocabulary): prefer "curl of a vector field" over "the curl thing"; put "∇×" and "curl operator" in aliases. Keep each concept ATOMIC (one notation / term / skill), never a whole topic.`}

Respond ONLY with valid JSON:
{
  "complete": boolean,
  "confidence": "low" | "medium" | "high",
  "xp_earned": number,
  "notes_to_save": [{"title": string, "content": string}],
  "learner_observations": string[],
  "concepts_taught": [{"name": string, "type": string, "definition": string, "aliases": string[]}],
  "concepts_required": [{"name": string, "type": string, "definition": string, "aliases": string[]}]${planJsonFields}
}`;

    const aiRes = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Session conversation:\n${(messages || []).map((m: any) => `${m.role}: ${m.content}`).join("\n\n")}\n\nAssess this session now.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      console.error("Assessment AI error:", aiRes.status);
      return new Response(JSON.stringify(fallback), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    let result: any;
    try {
      result = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      return new Response(JSON.stringify(fallback), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // With a plan, the checkpoints ARE the completion bar (docs/lesson-plan-layer.md §6). Enforcing
    // it here rather than trusting the rubric text is what turns it from a hope into a mechanism —
    // over-completion is the expensive failure, since it permanently marks a subtopic done and
    // schedules a review for material the session never covered.
    //
    // But the gate applies ONLY when the model actually reported checkpoints. Everything downstream
    // of `complete` — notes, concept extraction, subtopic status, review scheduling — is lost when it
    // is false, so a model that simply omits a field it has never been asked for before must not cost
    // a student the session they earned. Absent field => fall back to the general rubric, and say so
    // loudly in the logs. An explicitly EMPTY array is a real judgement and still gates.
    const requiredCheckpointIds = plan ? plan.checkpoints.map((c) => c.id) : [];
    const reportedMet = metCheckpointIds(result.checkpoints_met, requiredCheckpointIds);
    const checkpointsReported = plan !== null && reportedMet !== null;
    const checkpointsMet = reportedMet ?? [];
    const checkpointsUnmet = checkpointsReported
      ? requiredCheckpointIds.filter((id) => !checkpointsMet.includes(id))
      : [];

    if (plan && !checkpointsReported) {
      console.error(
        "assessment omitted checkpoints_met despite a plan being supplied — falling back to the general completion rubric for this session",
      );
    }

    const complete = result.complete === true && checkpointsUnmet.length === 0;
    if (checkpointsReported && result.complete === true && checkpointsUnmet.length > 0) {
      console.log("completion withheld — checkpoints unmet:", checkpointsUnmet.join(", "));
    }
    const confidence: "low" | "medium" | "high" =
      result.confidence === "high" || result.confidence === "medium" ? result.confidence : "low";
    const xpEarned = Math.max(10, Math.min(100, Math.round(Number(result.xp_earned) || 10)));
    const notes: { title: string; content: string }[] = Array.isArray(result.notes_to_save) ? result.notes_to_save : [];
    const learnerObservations: string[] = Array.isArray(result.learner_observations)
      ? result.learner_observations.filter((o: unknown): o is string => typeof o === "string" && o.trim().length > 0).map((o: string) => o.trim())
      : [];
    const conceptsTaught: ExtractedConcept[] = isReview ? [] : (Array.isArray(result.concepts_taught) ? result.concepts_taught : []);
    const conceptsRequired: ExtractedConcept[] = isReview ? [] : (Array.isArray(result.concepts_required) ? result.concepts_required : []);

    if (supabase && sessionId) {
      const nowIso = new Date().toISOString();
      try {
        if (!isReview && complete && userId && realSubtopicId) {
          const idByName = await resolveConcepts(supabase, conceptsTaught, conceptsRequired);
          const taughtIds = [...new Set(conceptsTaught.map((c) => idByName.get(norm(c.name))).filter(Boolean) as string[])];
          const requiredIds = [...new Set(conceptsRequired.map((c) => idByName.get(norm(c.name))).filter(Boolean) as string[])];

          const scRows = [
            ...taughtIds.map((id) => ({ subtopic_id: realSubtopicId, concept_id: id, role: "teaches" })),
            ...requiredIds.filter((id) => !taughtIds.includes(id)).map((id) => ({ subtopic_id: realSubtopicId, concept_id: id, role: "requires" })),
          ];
          if (scRows.length) await supabase.from("subtopic_concepts").upsert(scRows, { onConflict: "subtopic_id,concept_id,role", ignoreDuplicates: true });

          if (taughtIds.length) {
            await supabase.from("user_concept_knowledge").upsert(
              taughtIds.map((id) => ({ user_id: userId, concept_id: id, source_subtopic_id: realSubtopicId })),
              { onConflict: "user_id,concept_id", ignoreDuplicates: true },
            );
          }

          if (notes.length) {
            await supabase.from("notes").insert(
              notes.map((n) => ({ user_id: userId, subtopic_id: realSubtopicId, title: n.title, content: n.content, linked_concept_ids: taughtIds })),
            );
          }

          await supabase.from("subtopics").update({ status: "complete", completed_at: nowIso }).eq("id", realSubtopicId);

          try { await tickMatchingSpecItems(supabase, realSubtopicId, messages); }
          catch (e) { console.error("tickMatchingSpecItems failed:", e); }

          const { data: existingReview } = await supabase.from("subtopic_reviews").select("id").eq("user_id", userId).eq("subtopic_id", realSubtopicId).maybeSingle();
          if (!existingReview) {
            await supabase.from("subtopic_reviews").insert({
              user_id: userId, subtopic_id: realSubtopicId, interval_days: 7,
              next_review_due_at: new Date(Date.now() + 7 * DAY_MS).toISOString(), last_completed_at: nowIso,
            });
          }
        }

        if (isReview && userId && realSubtopicId) {
          const { data: row } = await supabase.from("subtopic_reviews").select("id, interval_days").eq("user_id", userId).eq("subtopic_id", realSubtopicId).maybeSingle();
          if (row) {
            const current = (row as any).interval_days || 7;
            const next = complete ? current * REVIEW_GROWTH[confidence] : current * REVIEW_LAPSE_FACTOR;
            const newInterval = Math.max(MIN_INTERVAL_DAYS, Math.min(MAX_INTERVAL_DAYS, Math.round(next)));
            await supabase.from("subtopic_reviews").update({
              interval_days: newInterval,
              next_review_due_at: new Date(Date.now() + newInterval * DAY_MS).toISOString(),
              ...(complete ? { last_completed_at: nowIso } : {}),
            }).eq("id", (row as any).id);
          }
        }

        await supabase.from("sessions").update({ completed_at: nowIso, xp_earned: xpEarned }).eq("id", sessionId);
        if (userId) {
          const { data: p } = await supabase.from("profiles").select("total_xp, learner_style_notes").eq("user_id", userId).maybeSingle();
          if (p) {
            const update: Record<string, unknown> = {};
            if (xpEarned > 0) update.total_xp = ((p as any).total_xp || 0) + xpEarned;
            if (learnerObservations.length) {
              const prior = ((p as any).learner_style_notes || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
              const combined = [...prior, ...learnerObservations.map((o) => `- ${o}`)];
              update.learner_style_notes = combined.slice(-MAX_LEARNER_OBSERVATIONS).join("\n");
            }
            if (Object.keys(update).length) await supabase.from("profiles").update(update).eq("user_id", userId);
          }
        }
      } catch (pipeErr) {
        console.error("completion pipeline error (assessment still returned):", pipeErr);
      }
    }

    // Checkpoint outcomes are NOT persisted: there is no column for them yet (`sessions` has no jsonb
    // or int[] field, and nothing else is a natural home). Returning them keeps the signal observable
    // — and usable for seeding the next session — until `sessions.checkpoints_met/_unmet` is added by
    // whoever owns the schema. Omitted entirely when no plan exists, so the no-plan response shape is
    // unchanged.
    return new Response(JSON.stringify({
      complete,
      confidence,
      xp_earned: xpEarned,
      notes_to_save: notes,
      concepts_taught: conceptsTaught.map((c) => c.name),
      concepts_required: conceptsRequired.map((c) => c.name),
      ...(plan ? { checkpoints_met: checkpointsMet, checkpoints_unmet: checkpointsUnmet } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("assess error:", e);
    return new Response(JSON.stringify(fallback), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
