import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { extractList } from "../util/extract-list.js";
import { peekInboundPushName } from "../util/fetch-messages.js";
import { displayNameFromChat, phoneJidFromChat } from "../util/jid.js";

const WEAK_NAMES = new Set(["você", "voce", "you", "tu"]);

function isWeakName(name: string | null | undefined): boolean {
  if (!name?.trim()) {
    return true;
  }
  return WEAK_NAMES.has(name.trim().toLowerCase());
}

interface ChatItem {
  remoteJid?: string;
  pushName?: string;
  name?: string;
  unreadCount?: number;
  updatedAt?: string;
  lastMessage?: {
    pushName?: string;
    key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean };
    message?: { conversation?: string };
  };
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
    .describe(
      "Substring filter against displayName, pushName, remoteJid, or phoneJid (case-insensitive). Ignored when where is provided."
    ),
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
        "Find chats for the pinned instance. Returns remoteJid, phoneJid (when LID), displayName (from message pushName when available), unreadCount, updatedAt.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;

        const payload: Record<string, unknown> = args.where
          ? { where: args.where, limit, offset }
          : { limit, offset };

        const raw = await client.post(`/chat/findChats/${client.instanceName}`, payload);
        const chats = extractList(raw, ["chats", "records"]) as ChatItem[];

        // Row-level enrich (no extra API). Peer names often missing when last msg is fromMe.
        const base = chats.map((c) => ({
          remoteJid: c.remoteJid,
          phoneJid: phoneJidFromChat(c),
          displayName: displayNameFromChat(c),
          pushName: c.pushName ?? null,
          name: c.name ?? null,
          unreadCount: c.unreadCount,
          updatedAt: c.updatedAt,
          lastText: c.lastMessage?.message?.conversation ?? null,
        }));

        // Name search needs inbound pushName before filter. Use a single findMessages
        // peek per weak-name chat (no LID resolve / no nested findChats).
        const needsNameSearch = Boolean(!args.where && args.search);
        let working = base;
        if (needsNameSearch) {
          working = await Promise.all(
            base.map(async (c) => {
              if (!isWeakName(c.displayName) || !c.remoteJid) {
                return c;
              }
              const inboundName = await peekInboundPushName(client, c.remoteJid, 20);
              return inboundName ? { ...c, displayName: inboundName } : c;
            })
          );
        }

        let filtered = working;
        if (!args.where && args.search) {
          const needle = args.search.toLowerCase();
          filtered = working.filter(
            (c) =>
              c.displayName?.toLowerCase().includes(needle) ||
              c.pushName?.toLowerCase().includes(needle) ||
              c.name?.toLowerCase().includes(needle) ||
              c.remoteJid?.toLowerCase().includes(needle) ||
              c.phoneJid?.toLowerCase().includes(needle) ||
              c.lastText?.toLowerCase().includes(needle)
          );
        }

        filtered = filtered.slice(offset, offset + limit);

        // For list (no search): only enrich the returned page with inbound names
        if (!needsNameSearch) {
          filtered = await Promise.all(
            filtered.map(async (c) => {
              if (!isWeakName(c.displayName) || !c.remoteJid) {
                return c;
              }
              const inboundName = await peekInboundPushName(client, c.remoteJid, 20);
              return inboundName ? { ...c, displayName: inboundName } : c;
            })
          );
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }],
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
