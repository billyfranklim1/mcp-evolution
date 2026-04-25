import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerFindLabels(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_labels",
    {
      title: "Find Labels",
      description: "List all WhatsApp labels for the pinned instance (requires WhatsApp Business).",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/label/findLabels/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
