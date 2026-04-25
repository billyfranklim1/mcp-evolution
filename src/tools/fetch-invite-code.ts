import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
};

export function registerFetchInviteCode(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "fetch_invite_code",
    {
      title: "Fetch Invite Code",
      description: "Fetch the invite code/link for a WhatsApp group via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get(
          `/group/inviteCode/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
