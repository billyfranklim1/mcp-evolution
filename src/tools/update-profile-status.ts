import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  status: z.string().min(1).describe("New status text (about) for the WhatsApp profile"),
};

export function registerUpdateProfileStatus(server: ToolRegistry): void {
  server.registerTool(
    "update_profile_status",
    {
      title: "Update Profile Status",
      description: "Update the 'about' status text of the selected WhatsApp instance's profile.",
      inputSchema: schema,
    },
    async (args, { client }) => {
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
