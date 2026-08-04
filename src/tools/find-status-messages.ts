import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { extractList } from "../util/extract-list.js";

const schema = {
  where: z
    .record(z.unknown())
    .optional()
    .describe("Optional filter object (e.g. { remoteJid, id, fromMe })"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .optional()
    .describe("Max results (default 50)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Skip first N results"),
};

export function registerFindStatusMessages(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_status_messages",
    {
      title: "Find Status Messages",
      description:
        "Find message status/ack records for the pinned instance (delivery/read receipts stored by Evolution).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const limit = args.limit ?? 50;
        const offset = args.offset ?? 0;
        const payload: Record<string, unknown> = { limit, offset };
        if (args.where) {
          payload.where = args.where;
        }

        // Trust API pagination (do not re-slice — that empties pages when offset > 0).
        const data = await client.post(`/chat/findStatusMessage/${client.instanceName}`, payload);
        const rows = extractList(data, ["messages", "status", "records"]);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
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
