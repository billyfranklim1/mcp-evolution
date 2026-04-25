import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  inviteCode: z.string().min(1).describe("Group invite code (the part after https://chat.whatsapp.com/)"),
};

export function registerAcceptInvite(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "accept_invite",
    {
      title: "Accept Invite",
      description: "Accept a WhatsApp group invite by invite code via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get(
          `/group/acceptInviteCode/${client.instanceName}?inviteCode=${encodeURIComponent(args.inviteCode)}`
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
