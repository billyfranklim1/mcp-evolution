import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const MessageKeySchema = z.object({
  remoteJid: z.string().min(1).describe("JID of the chat"),
  fromMe: z.boolean().describe("Whether the message was sent by this instance"),
  id: z.string().min(1).describe("Message ID"),
});

const schema = {
  chat: z
    .string()
    .min(1)
    .optional()
    .describe("Chat remoteJid to mark unread. Defaults to lastMessage[0].remoteJid."),
  lastMessage: z
    .array(MessageKeySchema)
    .min(1)
    .describe("Array of message keys marking the chat as unread (usually the last message)"),
};

export function registerMarkAsUnread(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "mark_as_unread",
    {
      title: "Mark as Unread",
      description: "Mark a chat as unread via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const chat = args.chat ?? args.lastMessage[0]!.remoteJid;
        const data = await client.post(`/chat/markChatUnread/${client.instanceName}`, {
          chat,
          lastMessage: args.lastMessage,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) {
          return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    }
  );
}
