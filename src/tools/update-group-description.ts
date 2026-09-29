import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  description: z.string().describe("New group description (empty string to clear)"),
};

export function registerUpdateGroupDescription(server: ToolRegistry): void {
  server.registerTool(
    "update_group_description",
    {
      title: "Update Group Description",
      description: "Update the description of a WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(
          `/group/updateGroupDescription/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { description: args.description }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
