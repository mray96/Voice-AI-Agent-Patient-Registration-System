import { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_WITHOUT_PARALLEL_TOOL_CALLS = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);
const CLOUDFLARE_CHAT_COMPLETIONS_URL =
  "https://api.cloudflare.com/client/v4/accounts";
const MAX_RATE_LIMIT_RETRY_MS = 2_000;

type OpenAiRequest = Record<string, unknown>;

function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function rateLimitRetryDelayMs(
  response: Response,
  errorBody: string,
): number | undefined {
  if (
    response.status !== 429 ||
    !errorBody.includes("rate_limit_exceeded")
  ) {
    return undefined;
  }

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }

  const retryMessage = errorBody.match(/try again in\s+([\d.]+)\s*ms/i);
  if (!retryMessage) return undefined;

  const delay = Number(retryMessage[1]);
  return Number.isFinite(delay) ? Math.max(0, Math.ceil(delay)) : undefined;
}

async function proxyCompletion(
  request: FastifyRequest,
  reply: any,
  cloudflareAccountId?: string,
) {
  const token = bearerToken(request);
  if (!token) {
    return reply.code(401).send({ error: "A bearer token is required" });
  }

  const input = (request.body ?? {}) as OpenAiRequest;
  const payload = { ...input };
  const requestedModel = typeof payload.model === "string" ? payload.model : "";
  const useCloudflare = requestedModel.startsWith("@cf/");

  if (useCloudflare && !cloudflareAccountId) {
    request.log.error("CLOUDFLARE_ACCOUNT_ID is not configured");
    return reply.code(503).send({
      error: "Cloudflare Workers AI account is not configured",
    });
  }

  // Groq rejects several sampling fields that Vapi may include. Preserve
  // Cloudflare's supported Chat Completions settings.
  if (!useCloudflare) {
    delete payload.temperature;
    delete payload.top_p;
    delete payload.top_k;

    // Groq defaults parallel_tool_calls to true, but GPT-OSS models do not
    // support parallel tool calls. Disable it for these models explicitly.
    if (
      GROQ_MODELS_WITHOUT_PARALLEL_TOOL_CALLS.has(requestedModel) &&
      Array.isArray(payload.tools) &&
      payload.tools.length > 0
    ) {
      payload.parallel_tool_calls = false;
    }
  }

  // Vapi sends max_tokens. Preserve its output cap under the current
  // OpenAI-compatible max_completion_tokens field.
  if (
    typeof payload.max_completion_tokens !== "number" &&
    typeof payload.max_tokens === "number"
  ) {
    payload.max_completion_tokens = payload.max_tokens;
  }
  delete payload.max_tokens;

  // These are Vapi metadata fields, not OpenAI chat-completions fields.
  delete payload.call;
  delete payload.assistant;
  delete payload.metadata;
  delete payload.timestamp;

  // Vapi expects an OpenAI-compatible streamed completion.
  payload.stream = true;

  const upstreamUrl = useCloudflare
    ? `${CLOUDFLARE_CHAT_COMPLETIONS_URL}/${encodeURIComponent(cloudflareAccountId!)}/ai/v1/chat/completions`
    : GROQ_CHAT_COMPLETIONS_URL;
  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
  let upstream = await fetch(upstreamUrl, requestOptions);
  let errorBody: string | undefined;

  if (upstream.status === 429) {
    errorBody = await upstream.text();
    const retryDelay = rateLimitRetryDelayMs(upstream, errorBody);
    if (retryDelay !== undefined && retryDelay <= MAX_RATE_LIMIT_RETRY_MS) {
      request.log.warn(
        { retryDelayMs: retryDelay },
        `Retrying ${useCloudflare ? "Cloudflare" : "Groq"} completion after a brief rate limit`,
      );
      await new Promise<void>((resolve) =>
        setTimeout(resolve, retryDelay + 50),
      );
      upstream = await fetch(upstreamUrl, requestOptions);
      errorBody = undefined;
    }
  }

  if (!upstream.ok) {
    errorBody ??= await upstream.text();
    request.log.error(
      { status: upstream.status, body: errorBody },
      `${useCloudflare ? "Cloudflare" : "Groq"} compatibility request failed`,
    );
    return reply
      .code(upstream.status)
      .type("application/json")
      .send(
        errorBody ||
          JSON.stringify({
            error: `${useCloudflare ? "Cloudflare" : "Groq"} request failed`,
          }),
      );
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

export async function registerLlmRoutes(
  app: FastifyInstance,
  cloudflareAccountId?: string,
) {
  await app.register(async (router) => {
    const handler = (request: FastifyRequest, reply: any) =>
      proxyCompletion(request, reply, cloudflareAccountId);
    router.post("/vapi/llm", handler);
    router.post("/vapi/llm/chat/completions", handler);
  });
}
