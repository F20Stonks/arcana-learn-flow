import { getGCPAccessToken } from "./googleAuth.ts";

export type AIConfig = {
  url: string;
  key: string;
  model: string;
  provider: "xai" | "vertex" | "vertex-express";
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
// Kept OUT of `cached` deliberately: a "vertex-express" config must never be handed to a caller
// that didn't explicitly ask for it (opts.allowExpress) — it speaks a wire protocol (native Gemini,
// via _shared/vertexExpress.ts) that a plain `fetch(ai.url, {...OpenAI-shape})` caller can't parse.
// A shared cache slot would leak it to the next unrelated getAIConfig() call in the same warm isolate.
const expressCached: Partial<Record<AITier, AIConfig>> = {};

// A Vertex-backed config's `key` is a bearer token that expires in ~1hr — an
// isolate that stays warm past that must not keep serving the stale one out
// of `cached`. Every other provider's key is a static env var, safe to trust
// forever, so only vertex bypasses the top-level cache hit below.
export async function getAIConfig(tier: AITier = "turn", opts?: { allowExpress?: boolean }): Promise<AIConfig> {
  // The authoring model is settable without a redeploy via Lovable's Cloud → Secrets panel (a free
  // settings action). Left unset, authoring runs on the same model as everything else — which makes
  // for a weaker plan, never a broken one.
  const authoringOverride = Deno.env.get("AUTHORING_MODEL");
  const strongerIfSet = (base: string) =>
    tier === "authoring" && authoringOverride ? authoringOverride : base;

  // Vertex AI Express Mode — plain API-key auth, billed against GCP (e.g. trial credit), no service
  // account/org-policy fighting required. Explicit double opt-in: the caller must both pass
  // allowExpress AND have the secret set. Speaks Gemini's native wire format, NOT the OpenAI shape
  // every other provider here returns — callers MUST route through _shared/vertexExpress.ts, never
  // `fetch(ai.url, ...)` directly — _shared/aiFetch.ts does that routing for every call site, which
  // is why express is now the default whenever the key is set (opts.allowExpress === false opts out).
  const expressKey = Deno.env.get("GCP_EXPRESS_API_KEY");
  if (opts?.allowExpress !== false && expressKey) {
    const hit = expressCached[tier];
    if (hit) return hit;
    const cfg: AIConfig = {
      url: "", // unused — vertexExpress.ts builds its own URL; present only to satisfy the AIConfig shape
      key: expressKey,
      // Gemini 3.7 Flash. NOTE THE PRICE, because it is not a free upgrade from the 2.5-flash this
      // used to default to: $0.75/$3.75 per 1M in/out on introductory pricing to 2026-12-31, versus
      // 2.5-flash's $0.30/$2.50 — so ~2.5x input, ~1.5x output. On 2027-01-01 introductory pricing
      // ends and it becomes $1.50/$7.50, i.e. 5x input and 3x output against 2.5-flash. Revisit this
      // line before that date, or set VERTEX_EXPRESS_MODEL to pin something cheaper.
      model: strongerIfSet(Deno.env.get("VERTEX_EXPRESS_MODEL") || "gemini-3.7-flash"),
      provider: "vertex-express",
    };
    expressCached[tier] = cfg;
    return cfg;
  }

  const hit = cached[tier];
  if (hit && hit.provider !== "vertex") return hit;

  // Vertex AI (OAuth/service account) — routes spend through GCP billing (e.g. trial credit) instead
  // of the Lovable gateway. Checked first: presence of the service-account secret is the explicit opt-in.
  const gcpProject = Deno.env.get("GCP_PROJECT_ID");
  if (Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") && gcpProject) {
    const region = Deno.env.get("GCP_REGION") || "us-central1";
    const token = await getGCPAccessToken();
    // Vertex's own OpenAI-compat endpoint takes bare model ids (no "google/" prefix — that's the
    // Lovable gateway's OpenRouter-style convention, a different surface). Model catalog moves;
    // VERTEX_MODEL overrides without a redeploy the same way AUTHORING_MODEL does. Kept in step with
    // the Express default above, including its pricing caveat.
    const model = strongerIfSet(Deno.env.get("VERTEX_MODEL") || "gemini-3.7-flash");
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
  // Express is the default provider when its key is set, so its cache slot is checked first —
  // otherwise sync callers would silently fall back to a config the async path never handed out.
  const hit = expressCached.turn ?? cached.turn;
  if (!hit) throw new Error("getAIConfig() must be awaited before calling getAIConfigSync()");
  return hit;
}
