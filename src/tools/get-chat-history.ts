import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { JidSchema } from "../schemas.js";
import { normalizeMessage } from "../util/normalize.js";

const schema = {
  remoteJid: JidSchema,
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
        "Get chat history for a specific contact or group JID. " +
        "Returns normalized { id, fromMe, remoteJid, timestamp, type, text, mediaKey?, quotedMessageId? } — raw payload dropped to prevent overflow.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;

        const payload = {
          where: { key: { remoteJid: args.remoteJid } },
          limit,
          offset,
        };
        const data = await client.post(`/chat/findMessages/${client.instanceName}`, payload);

        // Evolution may return { messages: [...] } or a bare array
        const rawArr: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { messages?: unknown[] }).messages)
            ? (data as { messages: unknown[] }).messages
            : [];

        // Client-side offset/limit safety net
        const sliced = rawArr.slice(offset, offset + limit);
        const normalized = sliced.map((m) => normalizeMessage(m as Parameters<typeof normalizeMessage>[0]));

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
