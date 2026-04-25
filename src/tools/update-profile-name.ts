import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  name: z.string().min(1).describe("New display name for the WhatsApp profile"),
};

export function registerUpdateProfileName(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "update_profile_name",
    {
      title: "Update Profile Name",
      description: "Update the display name of the pinned WhatsApp instance's profile.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/updateProfileName/${client.instanceName}`, {
          name: args.name,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
