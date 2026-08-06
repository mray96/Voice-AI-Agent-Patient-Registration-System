import { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

type OpenAiRequest = Record<string, unknown>;

function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

async function proxyCompletion(request: FastifyRequest, reply: any) {
  const token = bearerToken(request);
  if (!token) {
    return reply.code(401).send({ error: "A bearer token is required" });
  }

  const input = (request.body ?? {}) as OpenAiRequest;
  const payload = { ...input };

  // Vapi may add sampling fields that are not needed by the configured Groq
  // model, so remove them at the OpenAI-compatible proxy boundary.
  delete payload.temperature;
  delete payload.top_p;
  delete payload.top_k;
  delete payload.max_tokens;
  delete payload.max_completion_tokens;

  // These are Vapi metadata fields, not OpenAI chat-completions fields.
  delete payload.call;
  delete payload.assistant;
  delete payload.metadata;
  delete payload.timestamp;

  // Vapi expects an OpenAI-compatible streamed completion.
  payload.stream = true;

  const upstream = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    request.log.error(
      { status: upstream.status, body: errorBody },
      "Groq compatibility request failed",
    );
    return reply
      .code(upstream.status)
      .type("application/json")
      .send(errorBody || JSON.stringify({ error: "Groq request failed" }));
  }

  reply.code(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType) reply.header("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) reply.header("cache-control", cacheControl);

  if (!upstream.body) {
    return reply.send(await upstream.text());
  }

  return reply.send(Readable.fromWeb(upstream.body as ReadableStream));
}

export async function registerLlmRoutes(app: FastifyInstance) {
  await app.register(async (router) => {
    router.post("/vapi/llm", proxyCompletion);
    router.post("/vapi/llm/chat/completions", proxyCompletion);
  });
}
