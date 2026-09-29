import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerRemoveProfilePicture(server: ToolRegistry): void {
  server.registerTool(
    "remove_profile_picture",
    {
      title: "Remove Profile Picture",
      description: "Remove the profile picture of the selected WhatsApp instance.",
      inputSchema: {},
    },
    async (_args, { client }) => {
      try {
        const data = await client.delete(`/chat/removeProfilePicture/${client.instanceName}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
