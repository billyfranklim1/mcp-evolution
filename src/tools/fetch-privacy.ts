import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerFetchPrivacy(server: ToolRegistry): void {
  server.registerTool(
    "fetch_privacy",
    {
      title: "Fetch Privacy Settings",
      description: "Fetch the current privacy settings of the selected WhatsApp instance.",
      inputSchema: {},
    },
    async (_args, { client }) => {
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
