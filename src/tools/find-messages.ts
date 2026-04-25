import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { JidSchema, LimitSchema } from "../schemas.js";

const schema = {
  remoteJid: JidSchema,
  limit: LimitSchema,
};

export function registerFindMessages(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_messages",
    {
      title: "Find Messages",
      description:
        "Find messages by remoteJid (phone number or group JID) for the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload = {
          where: { key: { remoteJid: args.remoteJid } },
          limit: args.limit ?? 50,
        };
        const data = await client.post(`/chat/findMessages/${client.instanceName}`, payload);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (e) {
        if (e instanceof McpError) {
          return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    }
  );
}
