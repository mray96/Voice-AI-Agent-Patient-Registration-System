import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/server.js";
import { validPatientInput } from "./fixtures.js";
import { InMemoryPatientRepository } from "./helpers/in-memory-patient-repository.js";

describe("Vapi webhook", () => {
  let app: FastifyInstance;
  const secret = "test-vapi-secret-value";

  beforeEach(async () => {
    app = await buildApp({
      repository: new InMemoryPatientRepository(),
      vapiWebhookSecret: secret,
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects requests without the configured credential", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vapi/webhook",
      payload: { message: { type: "tool-calls", toolCallList: [] } },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("creates and then looks up a patient using Vapi tool calls", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/vapi/webhook",
      headers: { "x-vapi-secret": secret },
      payload: {
        message: {
          type: "tool-calls",
          toolCallList: [
            {
              id: "create-1",
              name: "create_patient",
              arguments: validPatientInput,
            },
          ],
        },
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const createResult = JSON.parse(
      createResponse.json().results[0].result,
    ) as Record<string, unknown>;
    expect(createResult.success).toBe(true);
    expect(createResult.action).toBe("created");

    const lookupResponse = await app.inject({
      method: "POST",
      url: "/vapi/webhook",
      headers: { authorization: `Bearer ${secret}` },
      payload: {
        message: {
          type: "tool-calls",
          toolCallList: [
            {
              id: "lookup-1",
              function: {
                name: "lookup_patient",
                arguments: JSON.stringify({
                  phone_number: "+1 415 555 0123",
                }),
              },
            },
          ],
        },
      },
    });
    const lookupResult = JSON.parse(
      lookupResponse.json().results[0].result,
    ) as Record<string, unknown>;
    expect(lookupResult.found).toBe(true);
  });

  it("returns a speakable failure result instead of timing out the call", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vapi/webhook",
      headers: { "x-vapi-secret": secret },
      payload: {
        message: {
          type: "tool-calls",
          toolCallList: [
            {
              id: "bad-1",
              name: "create_patient",
              arguments: { phone_number: "123" },
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.json().results[0].result);
    expect(result.success).toBe(false);
    expect(result.instruction).toContain("do not claim");
  });
});
