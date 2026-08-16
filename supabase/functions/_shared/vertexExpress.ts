/**
 * Calls Gemini via Vertex AI's "Express Mode" — plain API-key auth, no service
 * account, no OAuth, billed against whichever GCP project the key belongs to
 * (see aiConfig.ts's GCP_EXPRESS_API_KEY branch for how that config is picked).
 *
 * Express Mode's key-auth surface only speaks Gemini's NATIVE request/response
 * shape (`contents`/`parts`, streamGenerateContent) — it does not accept the
 * OpenAI-compatible `chat/completions` shape every call site in this app already
 * sends (confirmed by hand: the native endpoint returns 200, the openai-style
 * one 404s for this key). So unlike the OAuth "vertex" provider in aiConfig.ts
 * (which targets Vertex's own OpenAI-compatible surface and needs no
 * translation), this path needs a real shim — same pattern this repo already
 * used once, for the Anthropic-direct migration (git history: commit 7a2aa1b's
 * SSE translator in chat/index.ts). This is that pattern again, retargeted at
 * Gemini's stream shape instead of Anthropic's.
 *
 * Scope: built for chat/index.ts's streaming teaching turns only. The other AI
 * call sites stay on the Lovable gateway; extend this (non-streaming path,
 * response_format translation) only if one of them is deliberately migrated
 * later — don't build that speculatively.
 */

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentPart[];
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function partsFromContent(content: string | OpenAIContentPart[]): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((p): GeminiPart => {
    if (p.type === "image_url") {
      const url = p.image_url.url;
      const m = url.match(/^data:([^;]+);base64,(.*)$/);
      // Only inline data URLs are supported here; a remote URL is passed through as text so the
      // call degrades instead of throwing (Gemini needs bytes or a GCS URI, not an arbitrary URL).
      if (m) return { inlineData: { mimeType: m[1], data: m[2] } };
      return { text: url };
    }
    return { text: p.text };
  });
}

function textFromContent(content: string | OpenAIContentPart[]): string {
  return typeof content === "string"
    ? content
    : content.map((p) => (p.type === "text" ? p.text : "")).join("\n");
}

function toGeminiContents(messages: OpenAIMessage[]): {
  systemInstruction?: { parts: [{ text: string }] };
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
} {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => textFromContent(m.content));
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: partsFromContent(m.content),
    }));
  return systemParts.length
    ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] }, contents }
    : { contents };
}

/**
 * Translates a Gemini `streamGenerateContent?alt=sse` upstream body into the
 * OpenAI-style `data: {choices:[{delta:{content}}]}` chunks the frontend's SSE
 * parser (SessionPage.tsx) already expects, ending with the `[DONE]` sentinel
 * it also already expects — so nothing downstream of `chat/index.ts` changes.
 */
function translateStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  // Prompt-cache accounting. Gemini reports how much of the input it served from cache in
  // usageMetadata.cachedContentTokenCount, on the trailing chunks of the stream. Without logging it
  // there is no way to tell whether caching is working — a prompt whose static prefix got broken by an
  // edit still answers correctly, it just silently costs full price. Watch this ratio after any change
  // to the system prompt in chat/index.ts.
  let usage: { promptTokenCount?: number; cachedContentTokenCount?: number } | null = null;

  const emitEvent = (controller: ReadableStreamDefaultController<Uint8Array>, rawEvent: string) => {
    const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) return;
    try {
      const evt = JSON.parse(dataLine.slice(5).trim());
      if (evt?.usageMetadata) usage = evt.usageMetadata;
      const text = evt?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.length > 0) {
        const chunk = { choices: [{ delta: { content: text } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      // finishReason-only / safety-blocked chunks carry no text — silently
      // skipped, same as the historical Anthropic shim skips its own
      // non-content SSE events (message_start, ping, ...).
    } catch {
      // malformed or partial JSON at a chunk boundary — skip, not fatal
    }
  };

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Google's SSE framing here is CRLF (\r\n\r\n between events) — normalize to a single LF
          // convention before buffering so splitting logic doesn't have to care which one arrived.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            emitEvent(controller, rawEvent);
          }
        }
        // A final event with no trailing blank-line separator before the connection closed (short
        // replies can be a single chunk with nothing after it) would otherwise be silently dropped.
        if (buffer.trim().length > 0) emitEvent(controller, buffer);
      } finally {
        if (usage) {
          const total = usage.promptTokenCount ?? 0;
          const cached = usage.cachedContentTokenCount ?? 0;
          const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
          console.log(`[vertex-express] prompt tokens ${total}, cached ${cached} (${pct}%)`);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

/**
 * Drop-in replacement for `fetch(ai.url, {...})` when `ai.provider ===
 * "vertex-express"`. Returns a real Response — `.ok`/`.status`/`.text()` all
 * behave normally on failure (the raw upstream error response is passed
 * through unchanged), so callers need no new error-handling branch, only a
 * different call to produce `response`.
 */
export async function callVertexExpressChat(opts: {
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
}): Promise<Response> {
  const { systemInstruction, contents } = toGeminiContents(opts.messages);
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${opts.model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(systemInstruction ? { systemInstruction } : {}), contents }),
  });

  if (!upstream.ok || !upstream.body) return upstream;

  return new Response(translateStream(upstream.body), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}


/**
 * Non-streaming counterpart of callVertexExpressChat: takes the same OpenAI-shaped inputs every
 * other call site in this repo already builds, and returns a Response whose JSON body is the
 * OpenAI `{ choices: [{ message: { content } }] }` shape those call sites already parse. Failures
 * are passed through as the raw upstream Response, so `.ok`/`.status`/`.text()` behave normally.
 */
export async function callVertexExpressJSON(opts: {
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
  jsonMode?: boolean;
}): Promise<Response> {
  const { systemInstruction, contents } = toGeminiContents(opts.messages);
  const url =
    `https://aiplatform.googleapis.com/v1/publishers/google/models/${opts.model}:generateContent?key=${opts.apiKey}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(systemInstruction ? { systemInstruction } : {}),
      contents,
      ...(opts.jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
  });

  if (!upstream.ok) return upstream;

  const data = await upstream.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");

  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
