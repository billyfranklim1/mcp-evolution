import { z, type ZodRawShape } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";
import type { EvolutionClient, InstanceClient } from "./evolution-client.js";
import { GuardError } from "./errors.js";
import { enforceRecipients, RecipientPolicy } from "./guards/recipients.js";

/** Per-call context handed to every tool handler. */
export interface ToolContext {
  /** Client bound to the (allowlisted) instance chosen for this call. */
  client: InstanceClient;
  /** Recipient policy in force for that instance (use to filter listing results). */
  recipients: RecipientPolicy;
  /** Shared, stateless HTTP client (instance-agnostic helpers such as list_instances). */
  http: EvolutionClient;
  config: Config;
}

type ToolResult = CallToolResult;

export interface ToolDefinition<S extends ZodRawShape> {
  title?: string;
  description: string;
  inputSchema: S;
  /** false = tool is not bound to an instance (no `instance` param, no recipient checks). */
  instanceScoped?: boolean;
}

export interface ToolRegistry {
  registerTool<S extends ZodRawShape>(
    name: string,
    def: ToolDefinition<S>,
    handler: (args: z.objectOutputType<S, z.ZodTypeAny>, ctx: ToolContext) => Promise<ToolResult>
  ): void;
}

const INSTANCE_ERROR = "Instance is not configured. Use list_instances to see the allowed instances.";

/** Resolve which instance a call targets. Never returns a value outside the allowlist. */
export function resolveInstance(config: Config, requested: unknown): string {
  if (requested !== undefined && requested !== null && requested !== "") {
    if (typeof requested !== "string" || !config.instances.includes(requested)) {
      throw new GuardError(INSTANCE_ERROR);
    }
    return requested;
  }
  if (config.defaultInstance) return config.defaultInstance;
  throw new GuardError(
    "Multiple instances are configured and no default is set: pass the `instance` parameter " +
      "(see list_instances) or set EVOLUTION_DEFAULT_INSTANCE."
  );
}

export function recipientPolicyFor(config: Config, instance: string): RecipientPolicy {
  return new RecipientPolicy(config.instanceRecipients.get(instance) ?? config.globalRecipients);
}

function redactResult(result: ToolResult, redact: (s: string) => string): ToolResult {
  return {
    ...result,
    content: result.content.map((c) => (c.type === "text" ? { ...c, text: redact(c.text) } : c)),
  };
}

/**
 * Wrap an McpServer so every tool registration goes through the guards:
 * tool allowlist, instance allowlist/selection, recipient allowlist and secret redaction.
 */
export function createToolRegistry(server: McpServer, http: EvolutionClient, config: Config): ToolRegistry {
  const multi = config.instances.length > 1;
  const instanceParam = multi
    ? z
        .enum(config.instances as [string, ...string[]], { errorMap: () => ({ message: INSTANCE_ERROR }) })
        .optional()
        .describe(
          config.defaultInstance
            ? `WhatsApp instance to use (default: ${config.defaultInstance}). See list_instances.`
            : "WhatsApp instance to use (required: no default configured). See list_instances."
        )
    : undefined;

  return {
    registerTool(name, def, handler) {
      if (!config.allowedTools.has(name)) return;

      const scoped = def.instanceScoped !== false;
      const inputSchema: ZodRawShape = scoped && instanceParam ? { ...def.inputSchema, instance: instanceParam } : def.inputSchema;

      server.registerTool(
        name,
        { title: def.title, description: def.description, inputSchema },
        async (rawArgs: Record<string, unknown>): Promise<ToolResult> => {
          try {
            const { instance: requested, ...args } = rawArgs ?? {};
            const instance = scoped
              ? resolveInstance(config, requested)
              : (config.defaultInstance ?? config.instances[0]!);
            const recipients = recipientPolicyFor(config, instance);
            if (scoped) enforceRecipients(name, args, recipients);

            const client = http.forInstance(instance);
            const result = await handler(args as never, { client, recipients, http, config });
            return redactResult(result, http.redact);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { isError: true, content: [{ type: "text", text: http.redact(msg) }] };
          }
        }
      );
    },
  };
}
