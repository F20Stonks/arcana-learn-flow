export type AIConfig = {
  url: string;
  key: string;
  model: string;
  provider: "xai";
};

/**
 * Which job the model is being asked to do.
 *
 * "turn"      — live, latency-sensitive, high-volume: teaching turns, grading, scene JSON.
 * "authoring" — one-off, quality-critical, cached forever: lesson plans. Worth the strongest model
 *               available, because the cost is amortised across every user who ever studies that
 *               subtopic while the quality ceiling it sets is permanent.
 *
 * This is the seam the dead `pickModel()` stub in chat/index.ts was always waiting for.
 */
export type AITier = "turn" | "authoring";

const cached: Partial<Record<AITier, AIConfig>> = {};

// Reads the xAI API key from the app_secrets table (service role). Falls back to
// the XAI_API_KEY env var if the table is unavailable.
export async function getAIConfig(tier: AITier = "turn"): Promise<AIConfig> {
  const hit = cached[tier];
  if (hit) return hit;

  // The authoring model is settable without a redeploy via Lovable's Cloud → Secrets panel (a free
  // settings action). Left unset, authoring runs on the same model as everything else — which makes
  // for a weaker plan, never a broken one.
  const authoringOverride = Deno.env.get("AUTHORING_MODEL");
  const strongerIfSet = (base: string) =>
    tier === "authoring" && authoringOverride ? authoringOverride : base;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    const cfg: AIConfig = {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: strongerIfSet("google/gemini-3.6-flash"),
      provider: "xai",
    };
    cached[tier] = cfg;
    return cfg;
  }

  const envKey = Deno.env.get("XAI_API_KEY");
  if (envKey) {
    const cfg: AIConfig = {
      url: "https://api.x.ai/v1/chat/completions",
      key: envKey,
      model: strongerIfSet("grok-4-latest"),
      provider: "xai",
    };
    cached[tier] = cfg;
    return cfg;
  }

  throw new Error("No AI provider key configured (LOVABLE_API_KEY or XAI_API_KEY required)");
}

// Synchronous accessor for code paths that already awaited getAIConfig() once
// (the result is cached after the first call). Always returns the "turn" tier —
// the only tier those paths use.
export function getAIConfigSync(): AIConfig {
  const hit = cached.turn;
  if (!hit) throw new Error("getAIConfig() must be awaited before calling getAIConfigSync()");
  return hit;
}
