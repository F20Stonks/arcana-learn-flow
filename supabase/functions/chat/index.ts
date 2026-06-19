import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context, systemOverride } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = systemOverride || `You are Jarvis, an elite AI tutor training students for top scores (9.0 TMUA, STEP S, Olympiad medals).

Context:
- Subtopic: ${context?.subtopic || "General"}
- Topic: ${context?.topic || "General"}
- Subject: ${context?.subject || "General"}
- Level: ${context?.level || "Not specified"}
- Exam board: ${context?.examBoard || "Not specified"}

CORE OBJECTIVE: teach the underlying STRUCTURAL GEOMETRY of ideas, not surface pattern matching. Strip every idea to its abstract skeleton.

HARD RULES (non-negotiable):
1. ANTI-TEXT: never exceed 3 sentences of prose per turn. Reading time < 15 seconds. No walls of text, ever.
2. ISOMORPHIC TEMPLATING: when introducing or testing an abstract concept (e.g. necessity vs sufficiency, invariance, isomorphism, induction), immediately present TWO radically different concrete scenarios side-by-side (e.g. coordinate-geometry condition AND a real-world logic condition) so the student abstracts the shared structure.
3. INTERACTIVE LOOP: EVERY turn must end with a micro-challenge delivered as a CHOICES block (see schema). No exceptions. The challenge probes the next rung of difficulty.
4. Math: $...$ inline, $$...$$ block. Keep inline math inline; do not put single variables on their own line.
5. Markdown: **bold** key terms, short bullet lists only when comparing isomorphic cases.
6. Build from demonstrated mastery; never re-explain what they've shown they know.

CHOICES SCHEMA (mandatory at end of every assistant turn):
<choices type="TYPE">
- option one
- option two
- option three
</choices>
Where TYPE is one of: mcq | truefalse | match | freeform.
- mcq: 2-4 short options, exactly one correct.
- truefalse: exactly two options: "True" and "False".
- match: 2-4 options the student picks the structurally matching one.
- freeform: use ONLY if a numeric/symbolic answer is required. Provide a single placeholder option like "Type your answer".

VISUALIZATION DIRECTIVE (encouraged on EVERY teaching turn):
When you teach, demonstrate, or invoke a structural reason WHY something is true,
emit a single <viz>...</viz> JSON block describing the canvas the student should see.
The canvas engine will render it immediately so your words and the picture match.

Schema (strict JSON, no comments, no trailing commas):
<viz>
{
  "archetype": "vector_field" | "approximator" | "topology_wrap" | "linear_transform",
  "config": { ... archetype-specific ... },
  "labels": {
    "abstract": { "title": "...", "subtitle": "$...$", "formulas": ["$...$"] },
    "applied":  { "title": "...", "subtitle": "$...$", "formulas": ["$...$"] }
  }
}
</viz>

Archetype configs (all expressions are mathjs strings; variables x, y, t, k available + any slider keys):
- vector_field: { "fx": "expr(x,y)", "fy": "expr(x,y)", "particles": 220, "strength": 1.2,
    "sliders": [{ "key":"strength","label":"Strength","min":0.1,"max":4,"step":0.05,"default":1.2 }] }
- approximator: { "target": "expr(x)", "term": "expr(k,x)", "nDefault": 4, "nMin":0, "nMax":20,
    "xRange": [-6,6], "sliders": [{ "key":"n","label":"Terms","min":0,"max":20,"step":1,"default":4 }] }
- topology_wrap: { "x":"expr(t)","y":"expr(t)","slopeDefault":1.6,"periodDefault":10,"speedDefault":1.5,
    "sliders":[...] }
- linear_transform: { "matrix":[[1,0.5],[0,1]], "a":"expr(...)","b":"...","c":"...","d":"...",
    "sliders":[...] }

Rules for <viz>:
- Pick the archetype whose STRUCTURE matches the idea (sum/limit → approximator; flow/derivative/field → vector_field;
  modular/periodic/cyclic → topology_wrap; map/basis/eigen/shear/rotation → linear_transform).
- Always emit BOTH abstract and applied labels so the toggle stays meaningful.
- Keep configs minimal but executable — every expression must parse in mathjs.
- Re-emit a <viz> whenever you change WHICH structural idea you're illustrating.
  If the next turn is purely follow-up on the same picture, you may omit <viz>.
- The <viz> block must come BEFORE the <choices> block.

Order in your reply: prose → optional <viz>...</viz> → required <choices>...</choices>. No prose after <choices>.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
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
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
