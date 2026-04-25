import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const PrivacyValueSchema = z.enum(["all", "contacts", "contact_blacklist", "none"]);

const schema = {
  readreceipts: PrivacyValueSchema.optional().describe("Who can see read receipts"),
  profile: PrivacyValueSchema.optional().describe("Who can see the profile picture"),
  status: PrivacyValueSchema.optional().describe("Who can see status updates"),
  online: PrivacyValueSchema.optional().describe("Who can see online status"),
  last: PrivacyValueSchema.optional().describe("Who can see last seen"),
  groupadd: PrivacyValueSchema.optional().describe("Who can add to groups"),
  calladd: PrivacyValueSchema.optional().describe("Who can call"),
};

export function registerUpdatePrivacy(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "update_privacy",
    {
      title: "Update Privacy Settings",
      description: "Update privacy settings for the pinned WhatsApp instance. Values: all, contacts, contact_blacklist, none.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {};
        if (args.readreceipts !== undefined) payload["readreceipts"] = args.readreceipts;
        if (args.profile !== undefined) payload["profile"] = args.profile;
        if (args.status !== undefined) payload["status"] = args.status;
        if (args.online !== undefined) payload["online"] = args.online;
        if (args.last !== undefined) payload["last"] = args.last;
        if (args.groupadd !== undefined) payload["groupadd"] = args.groupadd;
        if (args.calladd !== undefined) payload["calladd"] = args.calladd;
        const data = await client.post(`/chat/updatePrivacySettings/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
