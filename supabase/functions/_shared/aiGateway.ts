// Provider-agnostic AI gateway config.
//
// Swap AI providers by setting Supabase function secrets — NO code change required.
// The functions here call an OpenAI-compatible /chat/completions endpoint, so any
// OpenAI-compatible provider (xAI/Grok, OpenRouter, Together, Groq, direct OpenAI, …)
// works by pointing these env vars at it.
//
// Secrets:
//   AI_API_KEY       – your provider key (e.g. an xAI/Grok key). Preferred.
//   AI_GATEWAY_URL   – chat-completions endpoint. Defaults to xAI when AI_API_KEY is set.
//   AI_MODEL_STRONG  – model for teaching, scene generation, track structuring,
//                      paper generation, assessment, and concept reconciliation.
//   AI_MODEL_CHEAP   – model for utility calls (spec resolution, checklist extraction).
//
// Backwards-compatible: if AI_API_KEY is NOT set, everything falls back to the
// original Lovable gateway + Gemini Flash, so nothing breaks until you flip over.

const AI_API_KEY = Deno.env.get("AI_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// A custom provider key present => use the custom provider (default: xAI/Grok).
const usingCustom = !!AI_API_KEY;

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const XAI_GATEWAY = "https://api.x.ai/v1/chat/completions";

export const AI_GATEWAY_URL =
  Deno.env.get("AI_GATEWAY_URL") ?? (usingCustom ? XAI_GATEWAY : LOVABLE_GATEWAY);

// Two-tier routing. Verify the exact provider model ids in your provider's console
// (e.g. console.x.ai) and set them as secrets — the defaults below are best-effort.
const DEFAULT_STRONG = usingCustom ? "grok-4" : "google/gemini-3-flash-preview";
const DEFAULT_CHEAP = usingCustom ? "grok-4-fast" : "google/gemini-3-flash-preview";

export const AI_MODEL_STRONG = Deno.env.get("AI_MODEL_STRONG") ?? DEFAULT_STRONG;
export const AI_MODEL_CHEAP = Deno.env.get("AI_MODEL_CHEAP") ?? DEFAULT_CHEAP;

if (usingCustom && !Deno.env.get("AI_MODEL_STRONG")) {
  console.warn(
    `[aiGateway] AI_MODEL_STRONG not set — defaulting to "${DEFAULT_STRONG}". ` +
      `Set it to the exact model id from your provider to avoid a 404.`,
  );
}

// Resolve the API key, preferring the custom provider, falling back to Lovable.
export function getAIKey(): string {
  const key = AI_API_KEY ?? LOVABLE_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "No AI key configured. Set AI_API_KEY (preferred) or LOVABLE_API_KEY as a function secret.",
    );
  }
  return key;
}
