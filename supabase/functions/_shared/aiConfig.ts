import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("XAI_API_KEY not configured and no service role to fetch it");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", "XAI_API_KEY")
    .maybeSingle();

  if (error || !data?.value) {
    throw new Error("XAI_API_KEY not found in app_secrets or env");
  }

  cached = {
    url: "https://api.x.ai/v1/chat/completions",
    key: data.value,
    model: "grok-4-latest",
    provider: "xai",
  };
  return cached;
}

// Synchronous accessor for code paths that already awaited getAIConfig() once
// (the result is cached after the first call).
export function getAIConfigSync(): AIConfig {
  if (!cached) throw new Error("getAIConfig() must be awaited before calling getAIConfigSync()");
  return cached;
}
