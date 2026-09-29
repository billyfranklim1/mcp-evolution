import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { JidSchema } from "../schemas.js";
import { fetchNormalizedMessages } from "../util/fetch-messages.js";

const schema = {
  remoteJid: JidSchema.describe(
    "Contact or group JID (phone @s.whatsapp.net, @lid, or @g.us). Linked LID/phone JIDs are both queried."
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .optional()
    .describe("Max messages to return (default 50, max 200)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Skip first N messages (default 0)."),
};

export function registerGetChatHistory(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "get_chat_history",
    {
      title: "Get Chat History",
      description:
        "Get chat history for a contact or group JID. Same as find_messages: merges LID/phone alternates and includes pushName. " +
        "Returns normalized { id, fromMe, remoteJid, remoteJidAlt?, pushName?, timestamp, type, text, mediaKey?, quotedMessageId? }.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;
        const normalized = await fetchNormalizedMessages(client, args.remoteJid, limit, offset);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }],
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
