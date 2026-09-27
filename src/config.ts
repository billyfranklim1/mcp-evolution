import { z } from "zod";
import { ConfigError } from "./errors.js";
import { resolveAllowedTools } from "./guards/tools.js";
import { parseRecipientList, recipientEnvName, type RecipientRule } from "./guards/recipients.js";

export { ConfigError };

const BaseSchema = z.object({
  EVOLUTION_API_URL: z.string().url("EVOLUTION_API_URL must be a valid URL"),
  EVOLUTION_API_KEY: z.string().min(1, "EVOLUTION_API_KEY is required"),
  EVOLUTION_INSTANCE: z.string().optional(),
  EVOLUTION_INSTANCES: z.string().optional(),
  EVOLUTION_DEFAULT_INSTANCE: z.string().optional(),
  EVOLUTION_BASIC_AUTH: z.string().min(1).optional(),
  EVOLUTION_DB_URL: z.string().url().optional(),
  EVOLUTION_ALLOWED_TOOLS: z.string().optional(),
  EVOLUTION_ALLOWED_RECIPIENTS: z.string().optional(),
});

export interface Config {
  apiUrl: string;
  apiKey: string;
  basicAuth?: string;
  dbUrl?: string;
  /** Allowlist of instances this process may talk to (never empty). */
  instances: readonly string[];
  /** Instance used when a tool call does not pass `instance` (undefined = caller must choose). */
  defaultInstance?: string;
  /** Tool names that will be registered. */
  allowedTools: ReadonlySet<string>;
  /** Global recipient rule (undefined = unrestricted). */
  globalRecipients?: RecipientRule;
  /** Per-instance overrides from EVOLUTION_ALLOWED_RECIPIENTS__<INSTANCE>. */
  instanceRecipients: ReadonlyMap<string, RecipientRule>;
}

function blankToUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function splitList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse and validate configuration from an env object. Throws ConfigError. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned: Record<string, string | undefined> = {};
  for (const key of Object.keys(BaseSchema.shape)) cleaned[key] = blankToUndefined(env[key]);

  const parsed = BaseSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new ConfigError(`Missing or invalid environment variables:\n${issues}`);
  }
  const e = parsed.data;

  // ── Instances ──────────────────────────────────────────────────────────────
  let instances: string[];
  if (e.EVOLUTION_INSTANCES) {
    if (e.EVOLUTION_INSTANCE) {
      throw new ConfigError(
        "Set either EVOLUTION_INSTANCE (single instance) or EVOLUTION_INSTANCES (list), not both. " +
          "Use EVOLUTION_DEFAULT_INSTANCE to pick a default among EVOLUTION_INSTANCES."
      );
    }
    instances = [...new Set(splitList(e.EVOLUTION_INSTANCES))];
  } else if (e.EVOLUTION_INSTANCE) {
    instances = [e.EVOLUTION_INSTANCE];
  } else {
    throw new ConfigError("EVOLUTION_INSTANCE or EVOLUTION_INSTANCES is required");
  }
  if (instances.length === 0) throw new ConfigError("EVOLUTION_INSTANCES must list at least one instance");
  for (const name of instances) {
    if (/[/?#\s]/.test(name)) throw new ConfigError(`Invalid instance name "${name}" (no '/', '?', '#' or spaces)`);
  }

  let defaultInstance: string | undefined;
  if (e.EVOLUTION_DEFAULT_INSTANCE) {
    if (!instances.includes(e.EVOLUTION_DEFAULT_INSTANCE)) {
      throw new ConfigError("EVOLUTION_DEFAULT_INSTANCE must be one of the configured instances");
    }
    defaultInstance = e.EVOLUTION_DEFAULT_INSTANCE;
  } else if (instances.length === 1) {
    defaultInstance = instances[0];
  }

  // ── Tools ──────────────────────────────────────────────────────────────────
  const allowedTools = resolveAllowedTools(e.EVOLUTION_ALLOWED_TOOLS);

  // ── Recipients ─────────────────────────────────────────────────────────────
  const globalRecipients = e.EVOLUTION_ALLOWED_RECIPIENTS
    ? parseRecipientList(e.EVOLUTION_ALLOWED_RECIPIENTS, "EVOLUTION_ALLOWED_RECIPIENTS")
    : undefined;

  const instanceRecipients = new Map<string, RecipientRule>();
  const seenEnvNames = new Map<string, string>();
  for (const name of instances) {
    const envName = recipientEnvName(name);
    const clash = seenEnvNames.get(envName);
    if (clash) {
      throw new ConfigError(
        `Instances "${clash}" and "${name}" map to the same variable ${envName}; rename one of them`
      );
    }
    seenEnvNames.set(envName, name);
    const raw = blankToUndefined(env[envName]);
    if (raw) instanceRecipients.set(name, parseRecipientList(raw, envName));
  }

  return {
    apiUrl: e.EVOLUTION_API_URL,
    apiKey: e.EVOLUTION_API_KEY,
    basicAuth: e.EVOLUTION_BASIC_AUTH,
    dbUrl: e.EVOLUTION_DB_URL,
    instances,
    defaultInstance,
    allowedTools,
    globalRecipients,
    instanceRecipients,
  };
}

/** CLI entrypoint helper: exits the process on invalid config. */
export function parseConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[mcp-evolution] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
