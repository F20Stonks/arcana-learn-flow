import { getAIConfig } from "../_shared/aiConfig.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: "Foundation level. Test basic recall and straightforward application. Simple calculations and definitions.",
  medium: "Intermediate. Requires understanding and application of concepts. Multi-step problems.",
  hard: "Advanced. Requires synthesis of multiple concepts, proof-based questions, and complex problem solving.",
  exam: "Authentic full-length exam-style paper. Match the exact format, mark scheme style, and difficulty of real past paper questions, including mark allocations per question.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { trackId, subject, level, examBoard, topics, difficulty, questionCount } = await req.json();
    const ai = await getAIConfig();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !ANON_KEY) throw new Error("Supabase env not configured");

    const authHeader = req.headers.get("Authorization") || "";
    const authedClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const count = Math.max(1, Math.min(25, Number(questionCount) || 10));
    const topicList = (topics || []).map((t: { topic: string; subtopics: string[] }) => `- ${t.topic}: ${(t.subtopics || []).join(", ")}`).join("\n");

    const systemPrompt = `You are an expert ${subject || "academic"} question writer setting a full practice paper for ${level || "A-Level"} ${examBoard ? `(${examBoard})` : ""} students.

Generate a complete practice paper of exactly ${count} questions covering these topics:
${topicList}

Difficulty: ${DIFFICULTY_GUIDE[difficulty] || DIFFICULTY_GUIDE.medium}

Use LaTeX notation with $ delimiters for inline math and $$ for block math where appropriate.

Respond ONLY with valid JSON:
{
  "title": "A short exam-style paper title, e.g. '${subject || "Practice"} Paper 1'",
  "questions": [
    {
      "question": "The question text with $LaTeX$ if needed",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "The correct answer (must match one option if MCQ)",
      "explanation": "Detailed step-by-step solution showing the structural reason the method works",
      "difficulty": "${difficulty}",
      "topic": "Topic name this question covers",
      "marks": 3
    }
  ]
}

For open-ended questions, omit the "options" field entirely. Distribute questions across the selected
topics and mark values realistically (harder/multi-step questions worth more marks). Favour questions that
require COMBINING more than one concept and TRANSFER to an unfamiliar context, not a re-skin of a standard
example.`;

    const aiRes = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the ${count}-question ${difficulty} paper now.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiRes.text();
      console.error("generate-paper AI error:", aiRes.status, t);
      throw new Error("AI error");
    }

    const data = await aiRes.json();
    let result: { title?: string; questions?: any[] };
    try {
      result = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      result = { title: undefined, questions: [] };
    }

    const questions = Array.isArray(result.questions) ? result.questions : [];
    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const totalMarks = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);
    const title = result.title || `${subject || "Practice"} Paper`;

    const { data: saved, error: insertErr } = await authedClient
      .from("generated_papers")
      .insert({
        user_id: userId, track_id: trackId, title, difficulty,
        topics: topics || [], questions, answers: [], total_marks: totalMarks,
      })
      .select()
      .single();

    if (insertErr || !saved) {
      console.error("generated_papers insert failed:", insertErr);
      return new Response(JSON.stringify({ paper: { title, difficulty, questions, total_marks: totalMarks }, persisted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ paper: saved, persisted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-paper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
