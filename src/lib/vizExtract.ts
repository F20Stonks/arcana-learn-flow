import type { SimulationPayload } from "./simulationPayload";
import type { SceneSpec } from "./sceneSpec";
import { isSceneSpec, sanitizeScene } from "./sceneSpec";

const VIZ_RE = /<viz>\s*([\s\S]*?)\s*<\/viz>/i;
const SCENE_RE = /<scene>\s*([\s\S]*?)\s*<\/scene>/i;

export interface VizExtractResult {
  text: string;
  viz: SimulationPayload | SceneSpec | null;
}

/**
 * Parse model-emitted JSON, tolerating the classic LLM slips: trailing
 * commas, // and block comments, and typographic quotes. Repairs are only
 * attempted after a strict parse fails, so well-formed JSON is untouched.
 */
export function parseModelJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    /* try repairs */
  }
  let s = raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  // strip // comments only outside of strings
  s = s
    .split("\n")
    .map((line) => {
      let inStr = false;
      for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '"' && line[i - 1] !== "\\") inStr = !inStr;
        else if (!inStr && line[i] === "/" && line[i + 1] === "/") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
  s = s.replace(/,\s*([}\]])/g, "$1");
  try {
    const parsed = JSON.parse(s);
    console.warn("[scene] JSON needed repair (comments/trailing commas)");
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pull a <scene>{...}</scene> (preferred) or <viz>{...}</viz> (legacy)
 * JSON block out of an assistant message. Returns the cleaned text and
 * either a sanitized SceneSpec or a legacy SimulationPayload. Unusable
 * JSON is dropped — the canvas keeps showing the previous visualization.
 */
export function extractViz(raw: string): VizExtractResult {
  // Prefer <scene> (new primitive spec)
  const sm = raw.match(SCENE_RE);
  if (sm) {
    const stripped = raw.replace(SCENE_RE, "").replace(VIZ_RE, "").trim();
    const parsed = parseModelJson(sm[1]);
    if (isSceneSpec(parsed)) return { text: stripped, viz: sanitizeScene(parsed) };
    if (parsed !== null) console.warn("[scene] parsed JSON is not a scene spec");
    return { text: stripped, viz: null };
  }

  const m = raw.match(VIZ_RE);
  if (!m) return { text: raw, viz: null };
  const stripped = raw.replace(VIZ_RE, "").trim();
  const parsed = parseModelJson(m[1]) as SimulationPayload | null;
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof parsed.archetype === "string" &&
    parsed.config &&
    parsed.labels?.abstract &&
    parsed.labels?.applied
  ) {
    return { text: stripped, viz: parsed };
  }
  return { text: stripped, viz: null };
}
