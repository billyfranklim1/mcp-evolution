import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerFindWebhook(server: ToolRegistry): void {
  server.registerTool(
    "find_webhook",
    {
      title: "Find Webhook",
      description: "Get the current webhook configuration for the selected WhatsApp instance.",
      inputSchema: {},
    },
    async (_args, { client }) => {
      try {
        const data = await client.get(`/webhook/find/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
