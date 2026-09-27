import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  action: z.enum(["add", "remove", "promote", "demote"])
    .describe("Action: add/remove members, promote to admin, demote from admin"),
  participants: z.array(z.string().min(1)).min(1).describe("Phone numbers or JIDs of participants"),
};

export function registerUpdateParticipants(server: ToolRegistry): void {
  server.registerTool(
    "update_participants",
    {
      title: "Update Participants",
      description: "Add, remove, promote, or demote participants in a WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(
          `/group/updateParticipant/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { action: args.action, participants: args.participants }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
