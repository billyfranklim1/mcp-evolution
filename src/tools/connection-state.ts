import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerConnectionState(server: ToolRegistry): void {
  server.registerTool(
    "connection_state",
    {
      title: "Connection State",
      description: "Get the current connection state of the selected WhatsApp instance (open, close, connecting).",
      inputSchema: {},
    },
    async (_args, { client }) => {
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
