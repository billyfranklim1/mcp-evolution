import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerRestartInstance(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "restart_instance",
    {
      title: "Restart Instance",
      description: "Restart the pinned WhatsApp instance (reconnects without logging out).",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.post(`/instance/restart/${client.instanceName}`, {});
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
