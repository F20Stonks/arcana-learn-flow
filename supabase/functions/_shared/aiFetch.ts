import type { AIConfig } from "./aiConfig.ts";
import { callVertexExpressChat, callVertexExpressJSON, type OpenAIMessage } from "./vertexExpress.ts";

/**
 * Single entry point for every AI call in this repo.
 *
 * Call sites keep building the OpenAI-shaped request body they always built; this decides the wire
 * format. For OpenAI-compatible providers (lovable gateway, xai, vertex OAuth) it's a plain POST to
 * `ai.url`. For `vertex-express` — which only speaks Gemini's native surface — it translates the
 * request and the response, so the caller's `.ok` / `.json()` / `.body` handling is unchanged.
 */
export async function aiFetch(
  ai: AIConfig,
  body: {
    model?: string;
    messages: OpenAIMessage[];
    stream?: boolean;
    response_format?: { type: string };
    [k: string]: unknown;
  },
): Promise<Response> {
  if (ai.provider === "vertex-express") {
    return body.stream
      ? await callVertexExpressChat({ apiKey: ai.key, model: ai.model, messages: body.messages })
      : await callVertexExpressJSON({
          apiKey: ai.key,
          model: ai.model,
          messages: body.messages,
          jsonMode: body.response_format?.type === "json_object",
        });
  }

  return await fetch(ai.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ai.model, ...body }),
  });
}
