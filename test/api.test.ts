import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/server.js";
import { validPatientInput } from "./fixtures.js";
import { InMemoryPatientRepository } from "./helpers/in-memory-patient-repository.js";

describe("patient REST API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({
      repository: new InMemoryPatientRepository(),
      vapiWebhookSecret: "test-vapi-secret-value",
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates, retrieves, filters, updates, and soft-deletes a patient", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/patients",
      payload: validPatientInput,
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json().data;
    expect(created.patient_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(created.date_of_birth).toBe("1990-06-15");

    const getResponse = await app.inject({
      method: "GET",
      url: `/patients/${created.patient_id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().data.last_name).toBe("O'Neil");

    const listResponse = await app.inject({
      method: "GET",
      url: "/patients?last_name=o%27neil&phone_number=415-555-0123",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/patients/${created.patient_id}`,
      payload: { city: "Oakland" },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.city).toBe("Oakland");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/patients/${created.patient_id}`,
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().data.deleted_at).not.toBeNull();

    const missingResponse = await app.inject({
      method: "GET",
      url: `/patients/${created.patient_id}`,
    });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toEqual({
      data: null,
      error: {
        code: "PATIENT_NOT_FOUND",
        message: "Patient was not found",
      },
    });
  });

  it("returns a consistent 422 envelope for invalid patient data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/patients",
      payload: { ...validPatientInput, phone_number: "123" },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().data).toBeNull();
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON and 404 for unknown routes", async () => {
    const malformed = await app.inject({
      method: "POST",
      url: "/patients",
      headers: { "content-type": "application/json" },
      payload: '{"broken":',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe("BAD_REQUEST");

    const missing = await app.inject({ method: "GET", url: "/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("serves health, Swagger UI, and the OpenAPI document", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(
      200,
    );
    expect((await app.inject({ method: "GET", url: "/docs" })).statusCode).toBe(
      200,
    );
    const openapi = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().info.title).toContain("Patient Registration");
  });
});
