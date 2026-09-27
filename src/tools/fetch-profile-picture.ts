import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
};

export function registerFetchProfilePicture(server: ToolRegistry): void {
  server.registerTool(
    "fetch_profile_picture",
    {
      title: "Fetch Profile Picture",
      description: "Fetch the profile picture URL of a WhatsApp contact via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(`/chat/fetchProfilePictureUrl/${client.instanceName}`, {
          number: args.number,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
