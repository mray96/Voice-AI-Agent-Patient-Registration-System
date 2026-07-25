import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres"),
  VAPI_WEBHOOK_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
});

export type AppConfig = z.output<typeof configSchema>;

export function loadConfig(environment = process.env): AppConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return parsed.data;
}
