import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { JidSchema, LimitSchema } from "../schemas.js";

const schema = {
  remoteJid: JidSchema,
  limit: LimitSchema,
};

export function registerGetChatHistory(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "get_chat_history",
    {
      title: "Get Chat History",
      description: "Get chat history for a specific contact or group JID.",
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
