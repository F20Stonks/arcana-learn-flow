export type AIConfig = {
  url: string;
  key: string;
  model: string;
  provider: "xai";
};

let cached: AIConfig | null = null;

// Reads the xAI API key from the app_secrets table (service role). Falls back to
// the XAI_API_KEY env var if the table is unavailable.
export async function getAIConfig(): Promise<AIConfig> {
  if (cached) return cached;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    cached = {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-3.6-flash",
      provider: "xai",
    };
    return cached;
  }

  const envKey = Deno.env.get("XAI_API_KEY");
  if (envKey) {
    cached = {
      url: "https://api.x.ai/v1/chat/completions",
      key: envKey,
      model: "grok-4-latest",
      provider: "xai",
    };
    return cached;
  }

  throw new Error("No AI provider key configured (LOVABLE_API_KEY or XAI_API_KEY required)");
}

// Synchronous accessor for code paths that already awaited getAIConfig() once
// (the result is cached after the first call).
export function getAIConfigSync(): AIConfig {
  if (!cached) throw new Error("getAIConfig() must be awaited before calling getAIConfigSync()");
  return cached;
}
