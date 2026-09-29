import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { parseConfig, type Config } from "./config.js";
import { EvolutionClient } from "./evolution-client.js";
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

export async function startServer(): Promise<void> {
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
  console.error(
    `[mcp-evolution] Started (instances: ${config.instances.join(", ")}; ` +
      `default: ${config.defaultInstance ?? "none"}; tools: ${config.allowedTools.size}; ` +
      `recipient allowlist: ${config.globalRecipients || config.instanceRecipients.size > 0 ? "on" : "off"})`
  );
}
