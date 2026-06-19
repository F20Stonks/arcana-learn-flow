import type { SimulationPayload } from "./simulationPayload";

const VIZ_RE = /<viz>\s*([\s\S]*?)\s*<\/viz>/i;

export interface VizExtractResult {
  text: string;
  viz: SimulationPayload | null;
}

/**
 * Pull a <viz>{...}</viz> JSON block out of an assistant message.
 * Returns the cleaned text and a parsed SimulationPayload (or null).
 * Defensive: malformed JSON is ignored silently — the canvas just keeps
 * showing the previous visualization.
 */
export function extractViz(raw: string): VizExtractResult {
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