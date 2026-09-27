import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  subject: z.string().min(1).describe("New group subject/name"),
};

export function registerUpdateGroupSubject(server: ToolRegistry): void {
  server.registerTool(
    "update_group_subject",
    {
      title: "Update Group Subject",
      description: "Update the name/subject of a WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(
          `/group/updateGroupSubject/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { subject: args.subject }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
