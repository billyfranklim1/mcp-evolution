import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerGetSettings(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "get_settings",
    {
      title: "Get Settings",
      description: "Get the current settings of the pinned WhatsApp instance.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/settings/find/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
