import { z } from "zod";

const ConfigSchema = z.object({
  EVOLUTION_API_URL: z.string().url("EVOLUTION_API_URL must be a valid URL"),
  EVOLUTION_API_KEY: z.string().min(1, "EVOLUTION_API_KEY is required"),
  EVOLUTION_INSTANCE: z.string().min(1, "EVOLUTION_INSTANCE is required"),
  EVOLUTION_DB_URL: z.string().url().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function parseConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[mcp-evolution] Missing or invalid environment variables:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}
