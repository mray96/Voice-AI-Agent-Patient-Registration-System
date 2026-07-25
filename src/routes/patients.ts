import type { FastifyInstance } from "fastify";
import {
  createPatientSchema,
  patientFilterSchema,
  patientIdSchema,
  updatePatientSchema,
} from "../domain/patient.js";
import { success } from "../lib/envelope.js";
import type { PatientService } from "../services/patient-service.js";

const patientProperties = {
  patient_id: { type: "string", format: "uuid" },
  first_name: { type: "string" },
  last_name: { type: "string" },
  date_of_birth: { type: "string", format: "date" },
  sex: {
    type: "string",
    enum: ["Male", "Female", "Other", "Decline to Answer"],
  },
  phone_number: { type: "string", example: "4155550123" },
  email: { anyOf: [{ type: "string", format: "email" }, { type: "null" }] },
  address_line_1: { type: "string" },
  address_line_2: { anyOf: [{ type: "string" }, { type: "null" }] },
  city: { type: "string" },
  state: { type: "string", minLength: 2, maxLength: 2 },
  zip_code: { type: "string" },
  insurance_provider: { anyOf: [{ type: "string" }, { type: "null" }] },
  insurance_member_id: { anyOf: [{ type: "string" }, { type: "null" }] },
  preferred_language: { type: "string" },
  emergency_contact_name: { anyOf: [{ type: "string" }, { type: "null" }] },
  emergency_contact_phone: {
    anyOf: [{ type: "string" }, { type: "null" }],
  },
  created_at: { type: "string", format: "date-time" },
  updated_at: { type: "string", format: "date-time" },
  deleted_at: {
    anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  },
} as const;

const patientSchema = {
  type: "object",
  properties: patientProperties,
} as const;

const patientInputProperties = {
  first_name: { type: "string", minLength: 1, maxLength: 50 },
  last_name: { type: "string", minLength: 1, maxLength: 50 },
  date_of_birth: {
    type: "string",
    description: "MM/DD/YYYY or ISO YYYY-MM-DD",
  },
  sex: {
    type: "string",
    enum: ["Male", "Female", "Other", "Decline to Answer"],
  },
  phone_number: { type: "string" },
  email: { type: "string", format: "email" },
  address_line_1: { type: "string" },
  address_line_2: { type: "string" },
  city: { type: "string" },
  state: { type: "string", minLength: 2, maxLength: 2 },
  zip_code: { type: "string" },
  insurance_provider: { type: "string" },
  insurance_member_id: { type: "string" },
  preferred_language: { type: "string", default: "English" },
  emergency_contact_name: { type: "string" },
  emergency_contact_phone: { type: "string" },
} as const;

const requiredPatientFields = [
  "first_name",
  "last_name",
  "date_of_birth",
  "sex",
  "phone_number",
  "address_line_1",
  "city",
  "state",
  "zip_code",
] as const;

export async function registerPatientRoutes(
  app: FastifyInstance,
  service: PatientService,
) {
  app.get(
    "/patients",
    {
      schema: {
        tags: ["Patients"],
        summary: "List active patients",
        querystring: {
          type: "object",
          properties: {
            last_name: { type: "string" },
            date_of_birth: { type: "string" },
            phone_number: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const filters = patientFilterSchema.parse(request.query);
      return success(await service.list(filters));
    },
  );

  app.get(
    "/patients/:id",
    {
      schema: {
        tags: ["Patients"],
        summary: "Retrieve one active patient",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const patientId = patientIdSchema.parse(params.id);
      return success(await service.get(patientId));
    },
  );

  app.post(
    "/patients",
    {
      schema: {
        tags: ["Patients"],
        summary: "Create a patient",
        body: {
          type: "object",
          required: [...requiredPatientFields],
          properties: patientInputProperties,
          additionalProperties: false,
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: patientSchema,
              error: { type: "null" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const input = createPatientSchema.parse(request.body);
      const patient = await service.create(input);
      return reply.code(201).send(success(patient));
    },
  );

  app.put(
    "/patients/:id",
    {
      schema: {
        tags: ["Patients"],
        summary: "Partially update an active patient",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          minProperties: 1,
          properties: patientInputProperties,
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const patientId = patientIdSchema.parse(params.id);
      const input = updatePatientSchema.parse(request.body);
      return success(await service.update(patientId, input));
    },
  );

  app.delete(
    "/patients/:id",
    {
      schema: {
        tags: ["Patients"],
        summary: "Soft-delete a patient",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const patientId = patientIdSchema.parse(params.id);
      return success(await service.remove(patientId));
    },
  );
}
