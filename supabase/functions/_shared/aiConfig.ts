// Temporary AI backend switch: if XAI_API_KEY is set, route to xAI (OpenAI-compatible);
// otherwise use the Lovable AI Gateway. Lets us fall back to Grok while Lovable AI credits are out.
export function getAIConfig() {
  const xai = Deno.env.get("XAI_API_KEY");
  if (xai) {
    return {
      url: "https://api.x.ai/v1/chat/completions",
      key: xai,
      model: "grok-2-1212",
      provider: "xai" as const,
    };
  }
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!lovable) throw new Error("Neither XAI_API_KEY nor LOVABLE_API_KEY is configured");
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: lovable,
    model: "google/gemini-3-flash-preview",
    provider: "lovable" as const,
  };
}