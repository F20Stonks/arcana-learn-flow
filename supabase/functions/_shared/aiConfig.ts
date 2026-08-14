import { getGCPAccessToken } from "./googleAuth.ts";

export type AIConfig = {
  url: string;
  key: string;
  model: string;
  provider: "xai" | "vertex";
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

// A Vertex-backed config's `key` is a bearer token that expires in ~1hr — an
// isolate that stays warm past that must not keep serving the stale one out
// of `cached`. Every other provider's key is a static env var, safe to trust
// forever, so only vertex bypasses the top-level cache hit below.
export async function getAIConfig(tier: AITier = "turn"): Promise<AIConfig> {
  const hit = cached[tier];
  if (hit && hit.provider !== "vertex") return hit;

  // The authoring model is settable without a redeploy via Lovable's Cloud → Secrets panel (a free
  // settings action). Left unset, authoring runs on the same model as everything else — which makes
  // for a weaker plan, never a broken one.
  const authoringOverride = Deno.env.get("AUTHORING_MODEL");
  const strongerIfSet = (base: string) =>
    tier === "authoring" && authoringOverride ? authoringOverride : base;

  // Vertex AI — routes spend through GCP billing (e.g. trial credit) instead of the Lovable
  // gateway. Checked first: presence of the service-account secret is the explicit opt-in.
  const gcpProject = Deno.env.get("GCP_PROJECT_ID");
  if (Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") && gcpProject) {
    const region = Deno.env.get("GCP_REGION") || "us-central1";
    const token = await getGCPAccessToken();
    // Vertex's own OpenAI-compat endpoint takes bare model ids (no "google/" prefix — that's the
    // Lovable gateway's OpenRouter-style convention, a different surface). Model catalog moves;
    // VERTEX_MODEL overrides without a redeploy the same way AUTHORING_MODEL does. UNVERIFIED
    // default — confirm the exact id in Model Garden before trusting it.
    const model = strongerIfSet(Deno.env.get("VERTEX_MODEL") || "gemini-2.5-flash");
    const cfg: AIConfig = {
      url: `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${gcpProject}/locations/${region}/endpoints/openapi/chat/completions`,
      key: token,
      model,
      provider: "vertex",
    };
    cached[tier] = cfg;
    return cfg;
  }

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

  throw new Error(
    "No AI provider key configured (GCP_SERVICE_ACCOUNT_JSON+GCP_PROJECT_ID, LOVABLE_API_KEY, or XAI_API_KEY required)",
  );
}

// Synchronous accessor for code paths that already awaited getAIConfig() once
// (the result is cached after the first call). Always returns the "turn" tier —
// the only tier those paths use.
export function getAIConfigSync(): AIConfig {
  const hit = cached.turn;
  if (!hit) throw new Error("getAIConfig() must be awaited before calling getAIConfigSync()");
  return hit;
}
