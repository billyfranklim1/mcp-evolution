import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerRestartInstance(server: ToolRegistry): void {
  server.registerTool(
    "restart_instance",
    {
      title: "Restart Instance",
      description: "Restart the selected WhatsApp instance (reconnects without logging out).",
      inputSchema: {},
    },
    async (_args, { client }) => {
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
