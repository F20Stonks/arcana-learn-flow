import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import {
  hasPlanIdentity,
  LESSON_PLAN_VERSION,
  planSignature,
  validateLessonPlan,
} from "../_shared/lessonPlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * The student-safe outline of a cached lesson plan — what the session is heading towards, and how
 * many checkpoints stand between here and done.
 *
 * WHY A SEPARATE FUNCTION, AND WHY SO LITTLE OF THE PLAN:
 * `chat` deliberately resolves the plan server-side and never lets it reach the browser, because the
 * plan carries the answers — `terminal_transfer.acceptable_reasoning`, every checkpoint's expected
 * evidence, the diagnostics that expose each misconception. Shipping the plan to the client to draw
 * a progress bar would hand the student the mark scheme.
 *
 * So this returns a strict allow-list, never a filtered copy: the core idea, the *claims* in the
 * derivation chain (the destinations, not the mechanisms that get you there), the notation, and a
 * checkpoint count. Adding a field here is a deliberate act — anything not named below cannot leak.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { subject, level, board, topic, subtopic } = await req.json();
    const identity = { subject, level, board, topic, subtopic };

    // No outline is a completely normal state — most subtopics have not been authored yet, and the
    // Navigator simply shows what it knows without one. Never an error.
    if (!hasPlanIdentity(identity)) {
      return new Response(JSON.stringify({ outline: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ outline: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = await planSignature(identity);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("lesson_plans")
      .select("plan")
      .eq("signature", signature)
      .eq("plan_version", LESSON_PLAN_VERSION)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ outline: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validated = validateLessonPlan((data as { plan: unknown }).plan);
    if (!validated.ok) {
      return new Response(JSON.stringify({ outline: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = validated.plan;
    const outline = {
      coreIdea: plan.core_idea,
      // `claim` only. `mechanism`, `rests_on` and `counterfactual` are the teaching itself — giving
      // those away in a side panel would let a student read the answer instead of deriving it.
      steps: plan.derivation_chain.map((s) => s.claim),
      checkpointCount: plan.checkpoints.length,
      notation: plan.notation.map((n) => ({ symbol: n.symbol, readAs: n.read_as })),
    };

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lesson-plan-outline error:", e);
    // Still a soft failure: the Navigator degrades to what it can derive client-side.
    return new Response(JSON.stringify({ outline: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
