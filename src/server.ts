import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import type { IncomingMessage, ServerResponse } from "node:http";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { ZodError } from "zod";
import { failure, success } from "./lib/envelope.js";
import { AppError } from "./lib/errors.js";
import type { PatientRepository } from "./repositories/patient-repository.js";
import { registerPatientRoutes } from "./routes/patients.js";
import { registerVapiRoutes } from "./routes/vapi.js";
import { registerLlmRoutes } from "./routes/llm.js";
import { PatientService } from "./services/patient-service.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { DrizzlePatientRepository } from "./repositories/drizzle-patient-repository.js";

export interface BuildAppOptions {
  repository: PatientRepository;
  vapiWebhookSecret: string;
  logger?: Exclude<FastifyServerOptions["logger"], undefined>;
}

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const fastifyOptions: FastifyServerOptions = {
    logger:
      options.logger ??
      {
        level: "info",
        redact: ["req.headers.authorization", "req.headers.x-vapi-secret"],
      },
  };
  const app: FastifyInstance = Fastify(fastifyOptions);
  const service = new PatientService(options.repository);

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Voice AI Patient Registration API",
        description:
          "Assessment REST API for managing fictional patient demographic records.",
        version: "1.0.0",
      },
      tags: [
        { name: "Patients", description: "Patient record operations" },
        { name: "Vapi", description: "Voice-agent integration" },
      ],
    },
  });
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Service health check",
      },
    },
    async () =>
      success({
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
  );

  await registerPatientRoutes(app, service);
  await registerVapiRoutes(app, service, options.vapiWebhookSecret);
  await registerLlmRoutes(app);

  app.get("/openapi.json", { schema: { hide: true } }, async () =>
    app.swagger(),
  );
  app.get("/docs", { schema: { hide: true } }, async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voice AI Patient Registration API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true
      });
    </script>
  </body>
</html>`);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(
      failure({
        code: "ROUTE_NOT_FOUND",
        message: "Route was not found",
      }),
    ),
  );

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send(
        failure({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: zodDetails(error),
        }),
      );
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(
        failure({
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        }),
      );
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.validation) {
      return reply.code(422).send(
        failure({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: fastifyError.validation,
        }),
      );
    }

    if (
      fastifyError.code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
      fastifyError.statusCode === 400
    ) {
      return reply.code(400).send(
        failure({
          code: "BAD_REQUEST",
          message: "Request body or parameters are malformed",
        }),
      );
    }

    request.log.error(error);
    return reply.code(500).send(
      failure({
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      }),
    );
  });

  return app;
}

// Vercel discovers src/server.ts as the Fastify entry point. Keep the
// application factory above reusable for local tests while exposing a lazy,
// cached Node-compatible handler for Vercel Functions.
let vercelAppPromise: Promise<FastifyInstance> | undefined;

async function getVercelApp(): Promise<FastifyInstance> {
  if (!vercelAppPromise) {
    vercelAppPromise = (async () => {
      const config = loadConfig();
      const { db } = createDatabase(config.DATABASE_URL);
      const repository = new DrizzlePatientRepository(db);
      return buildApp({
        repository,
        vapiWebhookSecret: config.VAPI_WEBHOOK_SECRET,
      });
    })();
  }
  return vercelAppPromise;
}

export default async function vercelHandler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const app = await getVercelApp();
  await app.ready();
  app.routing(request, response);
}
