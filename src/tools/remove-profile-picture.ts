import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

export function registerRemoveProfilePicture(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "remove_profile_picture",
    {
      title: "Remove Profile Picture",
      description: "Remove the profile picture of the pinned WhatsApp instance.",
      inputSchema: {},
    },
    async () => {
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
