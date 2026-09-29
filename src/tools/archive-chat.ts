import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  lastMessage: z.object({
    key: z.object({
      remoteJid: z.string().optional(),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }),
  }).describe("Last message object of the chat"),
  chat: z.string().min(1).describe("JID of the chat to archive/unarchive"),
  archive: z.boolean().describe("true to archive, false to unarchive"),
};

export function registerArchiveChat(server: ToolRegistry): void {
  server.registerTool(
    "archive_chat",
    {
      title: "Archive Chat",
      description: "Archive or unarchive a WhatsApp chat via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(`/chat/archiveChat/${client.instanceName}`, {
          lastMessage: args.lastMessage,
          chat: args.chat,
          archive: args.archive,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
