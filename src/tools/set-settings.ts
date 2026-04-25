import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  rejectCall: z.boolean().optional().describe("Automatically reject incoming calls"),
  msgCall: z.string().optional().describe("Auto-reply message when rejecting calls"),
  groupsIgnore: z.boolean().optional().describe("Ignore messages from groups"),
  alwaysOnline: z.boolean().optional().describe("Always appear online"),
  readMessages: z.boolean().optional().describe("Automatically mark messages as read"),
  syncFullHistory: z.boolean().optional().describe("Sync full message history on connect"),
  readStatus: z.boolean().optional().describe("Automatically read status updates"),
};

export function registerSetSettings(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "set_settings",
    {
      title: "Set Settings",
      description: "Update settings for the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {};
        if (args.rejectCall !== undefined) payload["rejectCall"] = args.rejectCall;
        if (args.msgCall !== undefined) payload["msgCall"] = args.msgCall;
        if (args.groupsIgnore !== undefined) payload["groupsIgnore"] = args.groupsIgnore;
        if (args.alwaysOnline !== undefined) payload["alwaysOnline"] = args.alwaysOnline;
        if (args.readMessages !== undefined) payload["readMessages"] = args.readMessages;
        if (args.syncFullHistory !== undefined) payload["syncFullHistory"] = args.syncFullHistory;
        if (args.readStatus !== undefined) payload["readStatus"] = args.readStatus;
        const data = await client.post(`/settings/set/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
