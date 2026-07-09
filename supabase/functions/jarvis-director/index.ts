import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Jarvis, an AI learning director. You help students plan their learning journey.

${mode === "onboarding" ? `ONBOARDING MODE:
Your job is to understand what the student wants to learn and create a structured learning track.

Conversation flow:
1. The student will tell you what they want to learn
2. Ask ONE follow-up question about their exam date or timeline (if relevant)
3. Then generate the learning track

When you're ready to generate the track, respond with a JSON object in your message. The JSON must be wrapped in <track> tags like this:

<track>
{
  "title": "A-Level Further Mathematics",
  "subject": "Mathematics",
  "emoji": "🧮",
  "exam_board": "Edexcel",
  "level": "A-Level",
  "exam_date": "2026-06-15",
  "topics": [
    {
      "title": "Complex Numbers",
      "subtopics": ["Introduction to Complex Numbers", "Argand Diagrams", "Complex Number Arithmetic", "De Moivre's Theorem", "Complex Roots of Polynomials"]
    },
    {
      "title": "Matrices",
      "subtopics": ["Matrix Operations", "Determinants", "Inverse Matrices", "Linear Transformations", "Eigenvalues and Eigenvectors"]
    }
  ]
}
</track>

Include a friendly message before the track data. Create 4-8 topics with 3-7 subtopics each, ordered logically from foundational to advanced. Be specific to the student's exam board and level if mentioned.

IMPORTANT: Only generate the track after you've asked about their timeline/exam date. If they haven't mentioned timing, ask about it first.` : "Help the student with their learning goals."}`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("Director error:", response.status, t);
      throw new Error("AI error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Check if response contains a track
    const trackMatch = content.match(/<track>([\s\S]*?)<\/track>/);
    if (trackMatch) {
      try {
        const track = JSON.parse(trackMatch[1]);
        const message = content.replace(/<track>[\s\S]*?<\/track>/, "").trim();
        return new Response(JSON.stringify({ message: message || "I've created your learning track! Let's get started.", track }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse track JSON:", e);
      }
    }

    return new Response(JSON.stringify({ message: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("director error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
