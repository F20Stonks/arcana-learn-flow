import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // ASSESS mode — evaluate a single answer
    if (body.mode === "assess") {
      const { question, correctAnswer, userAnswer, explanation, subject, level } = body;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          system: `You are an expert ${subject || "academic"} examiner at ${level || "A-Level"} standard. Assess the student's answer fairly. For mathematical answers, check mathematical equivalence not just string matching. Respond ONLY with valid JSON: {"correct": true/false, "feedback": "detailed explanation of why the answer is correct or incorrect, with the correct working shown"}`,
          messages: [
            {
              role: "user",
              content: `Question: ${question}\nCorrect answer: ${correctAnswer}\nStudent's answer: ${userAnswer}\nReference explanation: ${explanation}\n\nIs the student's answer correct? Provide detailed feedback.`
            },
            { role: "assistant", content: "{" },
          ],
        }),
      });

      if (!response.ok) {
        console.error("Assess error:", response.status);
        return new Response(JSON.stringify({ correct: false, feedback: explanation }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      let result;
      try {
        result = JSON.parse("{" + (data.content?.[0]?.text || "}"));
      } catch {
        result = { correct: false, feedback: explanation };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GENERATE mode — generate questions
    const { subject, level, examBoard, topics, difficulty, questionCount, questionType } = body;

    const topicList = topics.map((t: any) => `- ${t.topic}: ${t.subtopics.join(", ")}`).join("\n");

    const difficultyGuide: Record<string, string> = {
      easy: "Foundation level. Test basic recall and straightforward application. Simple calculations and definitions.",
      medium: "Intermediate. Requires understanding and application of concepts. Multi-step problems.",
      hard: "Advanced. Requires synthesis of multiple concepts, proof-based questions, and complex problem solving.",
      exam: `Authentic ${examBoard || ""} ${level || "A-Level"} exam style. Match the exact format, mark scheme style, and difficulty of real past paper questions.`,
    };

    const typeInstruction = questionType === "mcq"
      ? 'ALL questions must have exactly 4 options in an "options" array.'
      : questionType === "open"
      ? 'ALL questions must be open-ended (no options array).'
      : 'Mix of multiple choice (with 4 options) and open-ended questions.';

    const systemPrompt = `You are an expert ${subject || "academic"} question writer for ${level || "A-Level"} ${examBoard ? `(${examBoard})` : ""} students.

Generate exactly ${questionCount} questions covering these topics:
${topicList}

Difficulty: ${difficultyGuide[difficulty] || difficultyGuide.medium}
Question format: ${typeInstruction}

Use LaTeX notation with $ delimiters for inline math and $$ for block math where appropriate.

Respond ONLY with valid JSON:
{
  "questions": [
    {
      "question": "The question text with $LaTeX$ if needed",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "The correct answer (must match one option if MCQ)",
      "explanation": "Detailed step-by-step solution",
      "difficulty": "${difficulty}",
      "topic": "Topic name this question covers"
    }
  ]
}

For open-ended questions, omit the "options" field entirely.
Distribute questions across the selected topics. Make questions specific and rigorous.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Generate ${questionCount} ${difficulty} difficulty ${subject} questions now.` },
          { role: "assistant", content: "{" },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("Question gen error:", response.status, t);
      throw new Error("AI error");
    }

    const data = await response.json();
    const content = "{" + (data.content?.[0]?.text || "}");

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse questions JSON");
      result = { questions: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("question-attack error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
