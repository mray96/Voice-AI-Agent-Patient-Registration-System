import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { DrizzlePatientRepository } from "./repositories/drizzle-patient-repository.js";
import { buildApp } from "./server.js";

const config = loadConfig();
const { db, close } = createDatabase(config.DATABASE_URL);
const repository = new DrizzlePatientRepository(db);
const app = await buildApp({
  repository,
  vapiWebhookSecret: config.VAPI_WEBHOOK_SECRET,
});

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  await close();
  process.exit(1);
}

async function shutdown() {
  await app.close();
  await close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
