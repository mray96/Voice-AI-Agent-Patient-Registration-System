import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createPatientSchema,
  normalizePhone,
  patientIdSchema,
  updatePatientSchema,
} from "../domain/patient.js";
import { AppError } from "../lib/errors.js";
import type { PatientService } from "../services/patient-service.js";

const toolCallSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    arguments: z.unknown().optional(),
    parameters: z.unknown().optional(),
    function: z
      .object({
        name: z.string(),
        arguments: z.unknown().optional(),
      })
      .optional(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    message: z
      .object({
        type: z.string(),
        toolCallList: z.array(toolCallSchema).optional(),
        call: z
          .object({
            id: z.string().optional(),
          })
          .passthrough()
          .optional(),
        endedReason: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

type ToolCall = z.output<typeof toolCallSchema>;

function authorized(request: FastifyRequest, expectedSecret: string): boolean {
  const directHeader = request.headers["x-vapi-secret"];
  const authorization = request.headers.authorization;
  const received =
    typeof directHeader === "string"
      ? directHeader
      : authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function toolName(toolCall: ToolCall): string {
  return toolCall.name ?? toolCall.function?.name ?? "";
}

function toolArguments(toolCall: ToolCall): unknown {
  const value =
    toolCall.arguments ??
    toolCall.parameters ??
    toolCall.function?.arguments ??
    {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function toolResult(toolCallId: string, value: unknown) {
  return {
    toolCallId,
    result: JSON.stringify(value),
  };
}

async function executeTool(
  toolCall: ToolCall,
  service: PatientService,
): Promise<ReturnType<typeof toolResult>> {
  const name = toolName(toolCall);
  const rawArguments = toolArguments(toolCall);

  try {
    switch (name) {
      case "lookup_patient": {
        const input = z
          .object({ phone_number: z.string() })
          .passthrough()
          .parse(rawArguments);
        const phoneNumber = normalizePhone(input.phone_number);
        if (!phoneNumber) {
          throw new AppError(
            422,
            "INVALID_PHONE_NUMBER",
            "A valid 10-digit U.S. phone number is required",
          );
        }
        const patient = await service.findByPhone(phoneNumber);
        return toolResult(toolCall.id, {
          success: true,
          found: Boolean(patient),
          patient,
        });
      }

      case "create_patient": {
        const input = createPatientSchema.parse(rawArguments);
        const patient = await service.create(input);
        return toolResult(toolCall.id, {
          success: true,
          action: "created",
          patient,
        });
      }

      case "update_patient": {
        const input = z
          .object({ patient_id: z.string() })
          .passthrough()
          .parse(rawArguments);
        const patientId = patientIdSchema.parse(input.patient_id);
        const updatePayload = { ...(rawArguments as Record<string, unknown>) };
        delete updatePayload.patient_id;
        const updates = updatePatientSchema.parse(updatePayload);
        const patient = await service.update(patientId, updates);
        return toolResult(toolCall.id, {
          success: true,
          action: "updated",
          patient,
        });
      }

      default:
        throw new AppError(
          400,
          "UNKNOWN_TOOL",
          `Unsupported tool: ${name || "(missing name)"}`,
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The operation failed";
    console.error(
      JSON.stringify({
        event: "vapi.tool_failed",
        tool: name,
        message,
      }),
    );
    return toolResult(toolCall.id, {
      success: false,
      error: message,
      instruction:
        "Apologize briefly, do not claim the record was saved, and ask the caller to retry.",
    });
  }
}

export async function registerVapiRoutes(
  app: FastifyInstance,
  service: PatientService,
  webhookSecret: string,
) {
  app.post(
    "/vapi/webhook",
    {
      schema: {
        tags: ["Vapi"],
        summary: "Receive authenticated Vapi events and tool calls",
      },
    },
    async (request, reply) => {
      if (!authorized(request, webhookSecret)) {
        return reply.code(401).send({
          data: null,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid Vapi webhook credential",
          },
        });
      }

      const payload = webhookSchema.parse(request.body);
      if (payload.message.type === "tool-calls") {
        const calls = payload.message.toolCallList ?? [];
        const results = await Promise.all(
          calls.map((call) => executeTool(call, service)),
        );
        return { results };
      }

      if (payload.message.type === "end-of-call-report") {
        console.info(
          JSON.stringify({
            event: "vapi.call_ended",
            call_id: payload.message.call?.id,
            ended_reason: payload.message.endedReason,
          }),
        );
      }

      return {};
    },
  );
}
