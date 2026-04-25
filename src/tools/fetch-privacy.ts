import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerFetchPrivacy(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "fetch_privacy",
    {
      title: "Fetch Privacy Settings",
      description: "Fetch the current privacy settings of the pinned WhatsApp instance.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/chat/fetchPrivacySettings/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
