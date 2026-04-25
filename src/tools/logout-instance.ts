import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerLogoutInstance(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "logout_instance",
    {
      title: "Logout Instance",
      description: "Logout the pinned WhatsApp instance (disconnects and clears session — requires QR scan to reconnect).",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.delete(`/instance/logout/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
