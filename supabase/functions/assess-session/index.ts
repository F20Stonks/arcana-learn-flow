import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, subtopicId, messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are assessing a tutoring session. Based on the conversation, determine:
1. Whether the student has sufficiently understood the subtopic (complete: true/false)
2. Your confidence level (low/medium/high)
3. Key notes to save from this session (array of {title, content} objects)
4. XP to award (10-100 based on effort, understanding demonstrated, and difficulty)

Respond ONLY with a valid JSON object:
{
  "complete": true,
  "confidence": "high",
  "notes_to_save": [
    {"title": "Key concept name", "content": "Brief explanation of what was learned"}
  ],
  "xp_earned": 50
}`;

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
          { role: "user", content: `Session conversation:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join("\n\n")}\n\nAssess this session now.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("Assessment error:", response.status);
      return new Response(JSON.stringify({ complete: false, confidence: "low", notes_to_save: [], xp_earned: 10 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { complete: false, confidence: "low", notes_to_save: [], xp_earned: 10 };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assess error:", e);
    return new Response(JSON.stringify({ complete: false, confidence: "low", notes_to_save: [], xp_earned: 10 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
