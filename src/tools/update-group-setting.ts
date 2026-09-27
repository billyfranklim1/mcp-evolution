import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  action: z.enum(["announcement", "not_announcement", "locked", "unlocked"])
    .describe("announcement: only admins can send; not_announcement: all can send; locked/unlocked: group info edit"),
};

export function registerUpdateGroupSetting(server: ToolRegistry): void {
  server.registerTool(
    "update_group_setting",
    {
      title: "Update Group Setting",
      description: "Update group settings (announcement mode, locked) via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(
          `/group/updateSetting/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { action: args.action }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
