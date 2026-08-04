import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { extractList } from "../util/extract-list.js";

interface ContactItem {
  remoteJid?: string;
  pushName?: string;
  name?: string;
  profilePicUrl?: string;
  isBusiness?: boolean;
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
    .describe("Convenience substring filter against pushName, name, or remoteJid (case-insensitive). Ignored when where is provided."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .default(200)
    .optional()
    .describe("Max results to return (default 200, max 2000)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Skip first N results (default 0)."),
};

export function registerFindContacts(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_contacts",
    {
      title: "Find Contacts",
      description:
        "Find contacts for the pinned instance. Supports search (substring on pushName/name/remoteJid), limit, and offset. " +
        "Returns normalized { remoteJid, pushName, profilePicUrl, isBusiness }.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 200;
        const offset = args.offset ?? 0;

        const payload: Record<string, unknown> = args.where
          ? { where: args.where, limit, offset }
          : { limit, offset };

        const raw = await client.post(`/chat/findContacts/${client.instanceName}`, payload);
        let contacts = extractList(raw, ["contacts", "records"]) as ContactItem[];

        if (!args.where && args.search) {
          const needle = args.search.toLowerCase();
          contacts = contacts.filter(
            (c) =>
              c.pushName?.toLowerCase().includes(needle) ||
              c.name?.toLowerCase().includes(needle) ||
              c.remoteJid?.toLowerCase().includes(needle)
          );
        }

        contacts = contacts.slice(offset, offset + limit);

        const normalized = contacts.map(({ remoteJid, pushName, profilePicUrl, isBusiness }) => ({
          remoteJid,
          pushName,
          profilePicUrl,
          isBusiness,
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