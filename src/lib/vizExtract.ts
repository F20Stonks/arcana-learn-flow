import type { SimulationPayload } from "./simulationPayload";
import type { SceneSpec } from "./sceneSpec";
import { isSceneSpec } from "./sceneSpec";

const VIZ_RE = /<viz>\s*([\s\S]*?)\s*<\/viz>/i;
const SCENE_RE = /<scene>\s*([\s\S]*?)\s*<\/scene>/i;

export interface VizExtractResult {
  text: string;
  viz: SimulationPayload | SceneSpec | null;
}

/**
 * Pull a <scene>{...}</scene> (preferred) or <viz>{...}</viz> (legacy)
 * JSON block out of an assistant message. Returns the cleaned text and
 * either a SceneSpec or a legacy SimulationPayload. Malformed JSON is
 * ignored silently — the canvas keeps showing the previous visualization.
 */
export function extractViz(raw: string): VizExtractResult {
  // Prefer <scene> (new primitive spec)
  const sm = raw.match(SCENE_RE);
  if (sm) {
    const stripped = raw.replace(SCENE_RE, "").replace(VIZ_RE, "").trim();
    try {
      const parsed = JSON.parse(sm[1]);
      if (isSceneSpec(parsed)) return { text: stripped, viz: parsed };
    } catch { /* fall through */ }
    return { text: stripped, viz: null };
  }

  const m = raw.match(VIZ_RE);
  if (!m) return { text: raw, viz: null };
  const stripped = raw.replace(VIZ_RE, "").trim();
  try {
    const parsed = JSON.parse(m[1]);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.archetype === "string" &&
      parsed.config &&
      parsed.labels?.abstract &&
      parsed.labels?.applied
    ) {
      return { text: stripped, viz: parsed as SimulationPayload };
    }
  } catch {
    /* swallow — see comment above */
  }
  return { text: stripped, viz: null };
}