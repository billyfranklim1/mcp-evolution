import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { mimeToExt } from "../util/normalize.js";

const MEDIA_DIR = "/tmp/mcp-evolution-media";

const schema = {
  message: z.object({
    key: z.object({
      remoteJid: z.string().min(1).describe("Chat JID"),
      fromMe: z.boolean().describe("Whether sent by this instance"),
      id: z.string().min(1).describe("Message ID"),
    }),
  }).describe("Message object containing the media"),
  convertToMp4: z.boolean().optional().describe("Convert audio to mp4 format (forwarded to Evolution)"),
};

interface EvolutionMediaResponse {
  base64?: string;
  mediaType?: string;
  mimetype?: string;
  [key: string]: unknown;
}

export function registerDownloadMedia(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "download_media",
    {
      title: "Download Media",
      description:
        "Download media from a WhatsApp message and write it to disk. " +
        "Returns { path, mimetype, size, messageId } — NOT raw base64 (prevents context overflow). " +
        "File is written to /tmp/mcp-evolution-media/<instance>-<messageId>.<ext>. " +
        "Caller is responsible for cleanup (rm the file when done).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = { message: args.message };
        if (args.convertToMp4 !== undefined) payload["convertToMp4"] = args.convertToMp4;

        const data = await client.post(
          `/chat/getBase64FromMediaMessage/${client.instanceName}`,
          payload
        ) as EvolutionMediaResponse;

        const base64 = data.base64;
        if (!base64) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Evolution returned no base64 data for this message." }],
          };
        }

        const mimetype = data.mimetype ?? data.mediaType ?? "application/octet-stream";
        const ext = mimeToExt(mimetype);
        const messageId = args.message.key.id;
        const filename = `${client.instanceName}-${messageId}.${ext}`;
        const filePath = path.join(MEDIA_DIR, filename);

        // Ensure media dir exists (mode 0700 — only root/owner readable)
        await fs.mkdir(MEDIA_DIR, { recursive: true, mode: 0o700 });

        const buf = Buffer.from(base64, "base64");
        await fs.writeFile(filePath, buf, { mode: 0o600 });

        const result = { path: filePath, mimetype, size: buf.length, messageId };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
