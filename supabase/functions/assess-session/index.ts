import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Spaced-repetition scheduling bounds + confidence-scaled expansion. Expanding intervals beat fixed
// ones (Landauer–Bjork); how far a PASSED review pushes the next one depends on how solid the recall
// was, and a FAILED review CONTRACTS the interval instead of freezing it (a lapse must shorten, not stall).
const MIN_INTERVAL_DAYS = 3;
const MAX_INTERVAL_DAYS = 365;
const REVIEW_GROWTH: Record<"low" | "medium" | "high", number> = { low: 1.3, medium: 1.6, high: 2.5 };
const REVIEW_LAPSE_FACTOR = 0.4; // failed recall → pull the next interval back in

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

// Search-before-create resolution (framework §5/§7c). Returns norm(name) -> concept id.
async function resolveConcepts(
  supabase: ReturnType<typeof createClient>,
  taught: ExtractedConcept[],
  required: ExtractedConcept[],
  apiKey: string,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  // Unique specs by normalized name (merge taught + required; first spec wins).
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

  // One AI reconcile call for the ambiguous cases only (§7c: default to LINK on ambiguity).
  if (ambiguous.length > 0) {
    try {
      const payload = ambiguous.map((a, i) => ({
        index: i,
        concept: { name: a.spec.name, type: a.spec.type, definition: a.spec.definition },
        candidates: a.candidates.map((c) => ({ id: c.id, name: c.name, definition: c.definition })),
      }));
      const res = await fetch(`${ai.url}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
        // Any ambiguous item the model didn't return a decision for → link to top candidate (safe default).
        for (const item of ambiguous) {
          if (!resolved.has(item.key) && !toCreate.includes(item.spec)) {
            resolved.set(item.key, item.candidates[0].id);
          }
        }
      } else {
        // Reconcile call failed → default every ambiguous item to LINK to its top candidate.
        for (const item of ambiguous) resolved.set(item.key, item.candidates[0].id);
      }
    } catch (e) {
      console.error("reconcile failed, defaulting ambiguous to LINK:", e);
      for (const item of ambiguous) if (!resolved.has(item.key)) resolved.set(item.key, item.candidates[0].id);
    }
  }

  // Create the genuinely-new concepts.
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

// Auto-ticks spec_checklist_items mapped to a just-completed subtopic. "Simple" items are a pure
// computation (all their mapped subtopics complete → tick, no AI call). "Complex" items bundle multiple
// distinct requirements read off the spec's own wording (e.g. a derivation + a named method + a
// calculation) — those get checked against the FULL session transcript (not a compressed summary), since
// judging "was this specific method actually used" needs the real evidence, not a lossy note.
async function tickMatchingSpecItems(
  supabase: ReturnType<typeof createClient>,
  subtopicId: string,
  messages: { role: string; content: string }[],
  lovableApiKey: string,
) {
  const { data: itemsRaw } = await supabase
    .from("spec_checklist_items")
    .select("id, text, rigor, evidence_requirements, subtopic_ids, ticked")
    .contains("subtopic_ids", [subtopicId])
    .eq("ticked", false);
  const items = (itemsRaw || []) as unknown as SpecItemRow[];
  if (items.length === 0) return;

  // Resolve current status for every subtopic these items reference (an item can span more than one).
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
      const res = await fetch(`${ai.url}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const fallback = { complete: false, confidence: "low", notes_to_save: [], xp_earned: 10, concepts_taught: [], concepts_required: [] };

  try {
    const { sessionId, subtopicId, messages, intensity: rawIntensity } = await req.json();
    const ai = getAIConfig();
    const LOVABLE_API_KEY = ai.key;

    const intensity = rawIntensity === "guided" || rawIntensity === "rigorous" ? rawIntensity : "balanced";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;
    if (!supabase) console.error("SERVICE ROLE unavailable — assessment will return but no knowledge will be persisted");

    // Authoritative session facts (never trust the client for user/subtopic/type).
    let userId: string | null = null;
    let realSubtopicId: string | null = subtopicId || null;
    let sessionType = "learn";
    if (supabase && sessionId) {
      const { data: sess } = await supabase.from("sessions").select("user_id, subtopic_id, session_type").eq("id", sessionId).maybeSingle();
      if (sess) {
        userId = (sess as any).user_id;
        realSubtopicId = (sess as any).subtopic_id || realSubtopicId;
        sessionType = (sess as any).session_type || "learn";
      }
    }
    const isReview = sessionType === "review";

    const systemPrompt = `You are the assessment engine for an elite tutoring session (targets: 9.0 TMUA, STEP S, Olympiad medals). You read the FULL transcript of ONE session and return a strict JSON verdict. Be rigorous and repeatable — apply the rubrics literally. Do NOT award completion or XP for effort alone.
${isReview ? `\nThis is an ACTIVE-RECALL REVIEW session: the transcript tests recall of previously-learned material, it does not teach anything new. "complete" here means the student successfully recalled the material across the review's challenges. Leave "concepts_taught" and "concepts_required" as empty arrays (nothing new is taught in a review).\n` : ""}
COMPLETION RUBRIC — set "complete": true ONLY if ALL of these hold:
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

NOTES ("notes_to_save", 1-4 objects {title, content}): each "content" must capture the STRUCTURAL/CAUSAL takeaway — the mechanism, the load-bearing assumption, the counterfactual — NOT "we learned about X". Write them as durable revision notes the student can be quizzed on later.
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
  "concepts_taught": [{"name": string, "type": string, "definition": string, "aliases": string[]}],
  "concepts_required": [{"name": string, "type": string, "definition": string, "aliases": string[]}]
}`;

    const aiRes = await fetch(`${ai.url}`, {
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

    const complete = result.complete === true;
    const confidence: "low" | "medium" | "high" =
      result.confidence === "high" || result.confidence === "medium" ? result.confidence : "low";
    const xpEarned = Math.max(10, Math.min(100, Math.round(Number(result.xp_earned) || 10)));
    const notes: { title: string; content: string }[] = Array.isArray(result.notes_to_save) ? result.notes_to_save : [];
    const conceptsTaught: ExtractedConcept[] = isReview ? [] : (Array.isArray(result.concepts_taught) ? result.concepts_taught : []);
    const conceptsRequired: ExtractedConcept[] = isReview ? [] : (Array.isArray(result.concepts_required) ? result.concepts_required : []);

    // --- Completion pipeline (service role; each step best-effort so a partial failure never 500s) ---
    if (supabase && sessionId) {
      const nowIso = new Date().toISOString();
      try {
        if (!isReview && complete && userId && realSubtopicId) {
          // Resolve concepts, then write graph edges + knowledge.
          const idByName = await resolveConcepts(supabase, conceptsTaught, conceptsRequired, LOVABLE_API_KEY);
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

          // Notes (moved server-side so they can carry concept links).
          if (notes.length) {
            await supabase.from("notes").insert(
              notes.map((n) => ({ user_id: userId, subtopic_id: realSubtopicId, title: n.title, content: n.content, linked_concept_ids: taughtIds })),
            );
          }

          // Mark subtopic complete + schedule first review if not already scheduled (§4/§6).
          await supabase.from("subtopics").update({ status: "complete", completed_at: nowIso }).eq("id", realSubtopicId);

          // Tick any specification checklist items this subtopic satisfies (best-effort — a failure
          // here should never block the rest of the completion pipeline).
          try { await tickMatchingSpecItems(supabase, realSubtopicId, messages, LOVABLE_API_KEY); }
          catch (e) { console.error("tickMatchingSpecItems failed:", e); }

          const { data: existingReview } = await supabase.from("subtopic_reviews").select("id").eq("user_id", userId).eq("subtopic_id", realSubtopicId).maybeSingle();
          if (!existingReview) {
            await supabase.from("subtopic_reviews").insert({
              user_id: userId, subtopic_id: realSubtopicId, interval_days: 7,
              next_review_due_at: new Date(Date.now() + 7 * DAY_MS).toISOString(), last_completed_at: nowIso,
            });
          }
        }

        // Review session → reschedule with confidence-modulated expanding intervals, contracting on a
        // failed recall. Runs on EVERY review (pass or fail), not only completions, so a lapse actually
        // shortens the interval instead of leaving the item frozen and permanently overdue.
        if (isReview && userId && realSubtopicId) {
          const { data: row } = await supabase.from("subtopic_reviews").select("id, interval_days").eq("user_id", userId).eq("subtopic_id", realSubtopicId).maybeSingle();
          if (row) {
            const current = (row as any).interval_days || 7;
            const next = complete ? current * REVIEW_GROWTH[confidence] : current * REVIEW_LAPSE_FACTOR;
            const newInterval = Math.max(MIN_INTERVAL_DAYS, Math.min(MAX_INTERVAL_DAYS, Math.round(next)));
            await supabase.from("subtopic_reviews").update({
              interval_days: newInterval,
              next_review_due_at: new Date(Date.now() + newInterval * DAY_MS).toISOString(),
              // Only a passed review counts as "completed"; a lapse reschedules but isn't a completion.
              ...(complete ? { last_completed_at: nowIso } : {}),
            }).eq("id", (row as any).id);
          }
        }

        // Session bookkeeping + XP (both modes).
        await supabase.from("sessions").update({ completed_at: nowIso, xp_earned: xpEarned }).eq("id", sessionId);
        if (xpEarned > 0 && userId) {
          const { data: p } = await supabase.from("profiles").select("total_xp").eq("user_id", userId).maybeSingle();
          if (p) await supabase.from("profiles").update({ total_xp: ((p as any).total_xp || 0) + xpEarned }).eq("user_id", userId);
        }
      } catch (pipeErr) {
        console.error("completion pipeline error (assessment still returned):", pipeErr);
      }
    }

    return new Response(JSON.stringify({
      complete,
      confidence,
      xp_earned: xpEarned,
      notes_to_save: notes,
      concepts_taught: conceptsTaught.map((c) => c.name),
      concepts_required: conceptsRequired.map((c) => c.name),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("assess error:", e);
    return new Response(JSON.stringify(fallback), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
