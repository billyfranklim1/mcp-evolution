import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID to invite people to"),
  description: z.string().min(1).describe("Invite message description"),
  numbers: z.array(z.string().min(1)).min(1).describe("Phone numbers or JIDs to send the invite to"),
};

export function registerSendGroupInvite(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_group_invite",
    {
      title: "Send Group Invite",
      description: "Send a WhatsApp group invite link to specific contacts via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/group/sendInvite/${client.instanceName}`, {
          groupJid: args.groupJid,
          description: args.description,
          numbers: args.numbers,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
