import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  status: z.string().min(1).describe("New status text (about) for the WhatsApp profile"),
};

export function registerUpdateProfileStatus(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "update_profile_status",
    {
      title: "Update Profile Status",
      description: "Update the 'about' status text of the pinned WhatsApp instance's profile.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/updateProfileStatus/${client.instanceName}`, {
          status: args.status,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
