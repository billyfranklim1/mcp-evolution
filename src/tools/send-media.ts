import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  mediatype: z
    .enum(["image", "video", "audio", "document"])
    .describe("Media type: image, video, audio, or document"),
  media: z.string().min(1).describe("URL or base64 of the media"),
  fileName: z
    .string()
    .optional()
    .describe("Optional filename (required for document type)"),
  caption: z.string().optional().describe("Optional caption for the media"),
};

export function registerSendMedia(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_media",
    {
      title: "Send Media",
      description:
        "Send a media message (image, video, audio, document) via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          number: args.number,
          mediatype: args.mediatype,
          media: args.media,
        };
        if (args.fileName) payload["fileName"] = args.fileName;
        if (args.caption) payload["caption"] = args.caption;

        const data = await client.post(`/message/sendMedia/${client.instanceName}`, payload);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
