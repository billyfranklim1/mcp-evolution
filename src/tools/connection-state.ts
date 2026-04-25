import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerConnectionState(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "connection_state",
    {
      title: "Connection State",
      description: "Get the current connection state of the pinned WhatsApp instance (open, close, connecting).",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/instance/connectionState/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
