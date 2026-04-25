import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { EvolutionClient } from "./evolution-client.js";
import { registerAllTools } from "./tools/index.js";

export async function startServer(): Promise<void> {
  const config = parseConfig();
  const client = new EvolutionClient(config);

  const server = new McpServer({
    name: "mcp-evolution",
    version: "0.2.0",
  });

  registerAllTools(server, client);

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
  console.error(`[mcp-evolution] Started (instance: ${config.EVOLUTION_INSTANCE})`);
}
