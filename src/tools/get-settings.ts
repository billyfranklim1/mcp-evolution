import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerGetSettings(server: ToolRegistry): void {
  server.registerTool(
    "get_settings",
    {
      title: "Get Settings",
      description: "Get the current settings of the selected WhatsApp instance.",
      inputSchema: {},
    },
    async (_args, { client }) => {
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
