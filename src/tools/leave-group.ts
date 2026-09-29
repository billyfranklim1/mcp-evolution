import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID to leave (e.g. 120363000000000000@g.us)"),
};

export function registerLeaveGroup(server: ToolRegistry): void {
  server.registerTool(
    "leave_group",
    {
      title: "Leave Group",
      description: "Leave a WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.delete(
          `/group/leaveGroup/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
