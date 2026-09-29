import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { parseConfig, ConfigError, type Config } from "./config.js";
import { EvolutionClient } from "./evolution-client.js";
import { createHttpApp, loadHttpOptions, type HttpOptions } from "./http.js";
import { createToolRegistry } from "./registry.js";
import { registerAllTools } from "./tools/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/** Build a fully-guarded MCP server for the given config (no transport attached). */
export function createServer(config: Config): McpServer {
  const http = new EvolutionClient({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    basicAuth: config.basicAuth,
    dbUrl: config.dbUrl,
    instances: config.instances,
  });

  const server = new McpServer({ name: "mcp-evolution", version });
  registerAllTools(createToolRegistry(server, http, config));
  return server;
}

function describeConfig(config: Config): string {
  return (
    `instances: ${config.instances.join(", ")}; ` +
    `default: ${config.defaultInstance ?? "none"}; tools: ${config.allowedTools.size}; ` +
    `recipient allowlist: ${config.globalRecipients || config.instanceRecipients.size > 0 ? "on" : "off"}`
  );
}

export async function startServer(): Promise<void> {
  const mode = (process.env.MCP_TRANSPORT?.trim() || "stdio").toLowerCase();
  if (mode === "http") return startHttpServer();
  if (mode !== "stdio") {
    console.error(`[mcp-evolution] MCP_TRANSPORT must be "stdio" or "http" (got "${mode}")`);
    process.exit(1);
  }

  const config = parseConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  // Graceful shutdown — close transport cleanly on SIGINT/SIGTERM
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`[mcp-evolution] Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await server.connect(transport);
  console.error(`[mcp-evolution] Started (${describeConfig(config)})`);
}

async function startHttpServer(): Promise<void> {
  const config = parseConfig();
  let opts: HttpOptions;
  try {
    opts = loadHttpOptions(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[mcp-evolution] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const app = createHttpApp(() => createServer(config), opts);

  const shutdown = (signal: string): void => {
    console.error(`[mcp-evolution] Received ${signal}, shutting down...`);
    app.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await new Promise<void>((resolve) => app.listen(opts.port, opts.host, resolve));
  console.error(`[mcp-evolution] HTTP listening on ${opts.host}:${opts.port}${opts.path} (${describeConfig(config)})`);
}
