/**
 * Calls the REAL deployed chat edge function with the REAL Scene Director
 * prompt — byte-identical to production `directScene()` (same endpoint, same
 * anon-key auth, same systemOverride, same user-message shape), except we
 * keep the raw accumulated text for diagnostics and use the shared
 * `parseDirectorResponse` so parsing cannot drift from production.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENE_DIRECTOR_PROMPT, parseDirectorResponse } from "../../src/lib/sceneDirector";
import type { SceneSpec } from "../../src/lib/sceneSpec";
import type { BatteryConcept } from "./battery";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv(): { url: string; anonKey: string } {
  const envPath = join(here, "..", "..", ".env");
  const raw = readFileSync(envPath, "utf8");
  const get = (k: string) => {
    const m = raw.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"));
    if (!m) throw new Error(`${k} missing from .env`);
    return m[1];
  };
  return { url: get("VITE_SUPABASE_URL"), anonKey: get("VITE_SUPABASE_PUBLISHABLE_KEY") };
}

export const ENV = loadEnv();

/** Accumulate an OpenAI-style SSE stream into the full assistant text. */
async function accumulateSse(resp: Response): Promise<string> {
  if (!resp.body) return "";
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const j = line.slice(6).trim();
      if (j === "[DONE]") break;
      try {
        const d = JSON.parse(j).choices?.[0]?.delta?.content;
        if (d) acc += d;
      } catch {
        /* skip non-content events */
      }
    }
  }
  return acc;
}

/**
 * One raw model call through the deployed chat fn with a system override.
 * The free gateway rate-limits aggressively (first sweep: concurrency 3
 * produced 27/32 no-scenes — instant 429s plus streams cut mid-scene), so
 * this backs off and retries on 429 instead of surfacing it.
 */
export async function callChatFn(systemOverride: string, userContent: string): Promise<string> {
  const backoffs = [15000, 30000, 60000];
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(`${ENV.url}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.anonKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: userContent }],
        systemOverride,
      }),
    });
    if (resp.status === 429 && attempt < backoffs.length) {
      await resp.text().catch(() => "");
      await new Promise((r) => setTimeout(r, backoffs[attempt]));
      continue;
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`chat fn HTTP ${resp.status}: ${t.slice(0, 200)}`);
    }
    return accumulateSse(resp);
  }
}

export interface DirectorResult {
  raw: string;
  scene: SceneSpec | null;
  attempts: number;
  error?: string;
}

/**
 * Production-shaped Director call for one battery concept.
 * Mirrors directScene()'s user message exactly. One retry on a
 * parse-failure/empty response (recorded), since transient model slop is
 * part of what we're measuring but a single retry matches how a student
 * turn would effectively behave (next request fires soon anyway).
 */
export async function runDirector(c: BatteryConcept): Promise<DirectorResult> {
  const userContent = `SCENE REQUEST from the tutor:
${c.request}

Lesson context: subject=${c.subject} · topic=${c.topic} · subtopic=${c.subtopic} · level=${c.level}
`;
  let lastErr = "";
  let lastRaw = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callChatFn(SCENE_DIRECTOR_PROMPT, userContent);
      const scene = parseDirectorResponse(raw);
      if (scene) return { raw, scene, attempts: attempt };
      lastRaw = raw;
      // A raw that OPENS a <scene> but doesn't parse is a truncated stream
      // (rate-limit kill mid-generation), not a model failure — retry it.
      const truncated = raw.includes("<scene>") && !raw.includes("</scene>");
      lastErr = `${truncated ? "truncated stream" : "no parsable scene"} (head: ${raw.slice(0, 100).replace(/\n/g, " ")})`;
      if (!truncated && attempt >= 2) break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { raw: lastRaw, scene: null, attempts: 3, error: lastErr };
}
