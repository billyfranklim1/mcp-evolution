import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

interface ChatItem {
  remoteJid?: string;
  pushName?: string;
  name?: string;
  unreadCount?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

const schema = {
  where: z
    .record(z.unknown())
    .optional()
    .describe("Optional Prisma-style filter object (power-user). If supplied, search is ignored."),
  search: z
    .string()
    .optional()
    .describe("Convenience substring filter against pushName or remoteJid (case-insensitive). Ignored when where is provided."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .optional()
    .describe("Max results to return (default 50, max 500)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Skip first N results (default 0)."),
};

export function registerFindChats(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_chats",
    {
      title: "Find Chats",
      description:
        "Find chats for the pinned instance. Supports search, limit, and offset to prevent large payloads.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;

        // Build Evolution request body — pass limit/offset as top-level keys (Evolution v2)
        const payload: Record<string, unknown> = args.where
          ? { where: args.where, limit, offset }
          : { limit, offset };

        const raw = await client.post(`/chat/findChats/${client.instanceName}`, payload);

        let chats: ChatItem[] = Array.isArray(raw) ? raw : [];

        // Client-side search only when no custom where was supplied
        if (!args.where && args.search) {
          const needle = args.search.toLowerCase();
          chats = chats.filter(
            (c) =>
              c.pushName?.toLowerCase().includes(needle) ||
              c.remoteJid?.toLowerCase().includes(needle)
          );
        }

        // Client-side safety net for limit/offset (in case Evolution ignores them)
        chats = chats.slice(offset, offset + limit);

        // Normalize to compact shape — drop all extra fields to shrink payload
        const normalized = chats.map(({ remoteJid, pushName, name, unreadCount, updatedAt }) => ({
          remoteJid,
          pushName,
          name,
          unreadCount,
          updatedAt,
        }));

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
