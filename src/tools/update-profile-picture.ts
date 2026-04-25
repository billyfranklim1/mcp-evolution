import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  picture: z.string().min(1).describe("Base64 encoded image or URL for the profile picture"),
};

export function registerUpdateProfilePicture(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "update_profile_picture",
    {
      title: "Update Profile Picture",
      description: "Update the profile picture of the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/updateProfilePicture/${client.instanceName}`, {
          picture: args.picture,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
