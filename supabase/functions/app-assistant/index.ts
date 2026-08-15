// The in-app assistant: turns "where do I practise integration by parts" into an actual destination.
//
// Design constraint that shapes everything here: the model NEVER returns a URL. It returns a route
// KEY from a fixed list, plus an optional id, and the caller resolves that to a path. A model that
// can emit arbitrary paths can send a student anywhere — including somewhere that looks plausible
// and 404s — and no amount of prompting makes that safe. A closed vocabulary makes it impossible.
//
// The assistant is deliberately small: it routes, it explains the app, and it can ask for a course's
// resources to be resolved. It does not teach — that is what a session is for, and an assistant that
// half-teaches in a dialog box quietly competes with the thing the product is actually good at.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";
import { getAIConfig } from "../_shared/aiConfig.ts";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * The closed vocabulary. `:id` routes require the model to also return an id, which is checked
 * against the caller's OWN rows before it is used — so the assistant cannot navigate a student into
 * someone else's track by guessing a uuid.
 */
const ROUTES: Record<string, { path: string; needsId?: "track" | "subtopic"; blurb: string }> = {
  dashboard: { path: "/dashboard", blurb: "home — what to do next, and the tutor chat" },
  track: { path: "/track/:id", needsId: "track", blurb: "one learning track's topic list and progress" },
  session: { path: "/session/:id", needsId: "subtopic", blurb: "start or resume a teaching session on one subtopic" },
  notes: { path: "/track/:id/notes", needsId: "track", blurb: "saved notes for a track" },
  questions: { path: "/track/:id/questions", needsId: "track", blurb: "question attack — timed practice for a track" },
  papers: { path: "/track/:id/papers", needsId: "track", blurb: "past and generated papers for a track" },
  questionBank: { path: "/question-bank", blurb: "the whole question bank, across every track" },
  referenceQuestions: { path: "/reference-questions", blurb: "real competition/admissions questions (STEP, etc.)" },
  resourceBank: { path: "/resource-bank", blurb: "reference documents and resources" },
  concepts: { path: "/concepts", blurb: "concepts the student has learned" },
  map: { path: "/map", blurb: "the knowledge map — concepts and how they connect" },
  reviews: { path: "/reviews", blurb: "the spaced-review calendar — what is due" },
  analytics: { path: "/analytics", blurb: "progress and practice analytics" },
  settings: { path: "/settings", blurb: "account, billing, appearance and privacy" },
};

const SYSTEM = `You are the in-app assistant for Cortexed, a maths and physics learning app. You help a student USE the app: you send them to the right place, explain how something works, or ask for a course's resources to be fetched.

You never teach the subject itself — a teaching session does that far better, so if they want to learn something, send them to it.

Reply ONLY with JSON:
{"action":"navigate","route":"<route key>","id":"<id if the route needs one>","message":"<one short sentence>"}
{"action":"answer","message":"<a short, concrete answer about using the app>"}
{"action":"resources","course":"<course name>","message":"<one short sentence>"}

Rules:
- "route" MUST be one of the keys given below. Never invent a route, and never return a URL or path.
- Routes marked (needs track id) or (needs subtopic id) require "id" to be one of the ids listed in the context. If no listed id fits, use action "answer" and say what is missing instead of guessing.
- Prefer "navigate" when the student clearly wants to go somewhere or do something.
- Use "resources" only when they are asking to FETCH or FIND papers/materials for a named course.
- Keep "message" to one sentence. No preamble, no markdown.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;

    // Only the caller's OWN tracks and subtopics are ever put in front of the model, and the id it
    // returns is checked back against these — so a hallucinated uuid resolves to nothing rather than
    // to another student's data.
    const tracks: { id: string; title: string }[] = [];
    const subtopics: { id: string; title: string }[] = [];
    if (supabase) {
      const { data: t } = await supabase
        .from("learning_tracks")
        .select("id, title, subject, level")
        .eq("user_id", userId)
        .limit(20);
      for (const row of (t || []) as { id: string; title: string }[]) tracks.push({ id: row.id, title: row.title });

      if (tracks.length) {
        const { data: s } = await supabase
          .from("subtopics")
          .select("id, title, topic_id, topics!inner(track_id)")
          .in("topics.track_id", tracks.map((x) => x.id))
          .limit(120);
        for (const row of (s || []) as { id: string; title: string }[]) subtopics.push({ id: row.id, title: row.title });
      }
    }

    const routeList = Object.entries(ROUTES)
      .map(([k, v]) => `- ${k}: ${v.blurb}${v.needsId ? ` (needs ${v.needsId} id)` : ""}`)
      .join("\n");
    const context = `ROUTES:\n${routeList}\n\nTHIS STUDENT'S TRACKS:\n${
      tracks.map((t) => `- ${t.id} :: ${t.title}`).join("\n") || "(none yet)"
    }\n\nTHIS STUDENT'S SUBTOPICS (id :: title):\n${
      subtopics.slice(0, 120).map((s) => `- ${s.id} :: ${s.title}`).join("\n") || "(none yet)"
    }`;

    const ai = await getAIConfig("turn");
    const res = await aiFetch(ai, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${context}\n\nSTUDENT ASKED: ${query}` },
      ],
      response_format: { type: "json_object" },
    });
    if (!res.ok) {
      console.error("app-assistant AI error:", res.status);
      return new Response(JSON.stringify({ action: "answer", message: "I couldn't reach the assistant just now." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    let parsed: { action?: string; route?: string; id?: string; course?: string; message?: string } = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";

    if (parsed.action === "navigate") {
      const route = parsed.route ? ROUTES[parsed.route] : undefined;
      if (!route) {
        console.warn("app-assistant returned an unknown route:", parsed.route);
        return new Response(JSON.stringify({ action: "answer", message: message || "I'm not sure where to send you for that." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let path = route.path;
      if (route.needsId) {
        const pool = route.needsId === "track" ? tracks : subtopics;
        const hit = pool.find((x) => x.id === parsed.id);
        if (!hit) {
          // The id was invented, or belongs to someone else. Either way it is not navigable.
          return new Response(JSON.stringify({ action: "answer", message: "I couldn't find that in your tracks." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        path = path.replace(":id", hit.id);
      }
      return new Response(JSON.stringify({ action: "navigate", path, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.action === "resources" && parsed.course) {
      return new Response(JSON.stringify({ action: "resources", course: parsed.course, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ action: "answer", message: message || "I'm not sure — try rephrasing?" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("app-assistant error:", e);
    return new Response(JSON.stringify({ action: "answer", message: "Something went wrong." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
