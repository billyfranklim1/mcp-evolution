import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerLogoutInstance(server: ToolRegistry): void {
  server.registerTool(
    "logout_instance",
    {
      title: "Logout Instance",
      description: "Logout the selected WhatsApp instance (disconnects and clears session — requires QR scan to reconnect).",
      inputSchema: {},
    },
    async (_args, { client }) => {
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
