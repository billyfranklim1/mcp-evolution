import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  image: z.string().min(1).describe("Base64 encoded image or URL for the group picture"),
};

export function registerUpdateGroupPicture(server: ToolRegistry): void {
  server.registerTool(
    "update_group_picture",
    {
      title: "Update Group Picture",
      description: "Update the profile picture of a WhatsApp group via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(
          `/group/updateGroupPicture/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { image: args.image }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
