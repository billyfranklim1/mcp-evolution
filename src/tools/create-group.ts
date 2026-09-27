import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  subject: z.string().min(1).describe("Group name/subject"),
  description: z.string().optional().describe("Optional group description"),
  participants: z.array(z.string().min(1)).min(1).describe("Array of participant phone numbers or JIDs"),
};

export function registerCreateGroup(server: ToolRegistry): void {
  server.registerTool(
    "create_group",
    {
      title: "Create Group",
      description: "Create a new WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const payload: Record<string, unknown> = {
          subject: args.subject,
          participants: args.participants,
        };
        if (args.description) payload["description"] = args.description;
        const data = await client.post(`/group/create/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
