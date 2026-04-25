import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  enabled: z.boolean().describe("Enable or disable the webhook"),
  url: z.string().url().describe("Webhook URL to receive events"),
  byEvents: z.boolean().optional().describe("Send separate requests per event type"),
  base64: z.boolean().optional().describe("Send media as base64 in webhook payload"),
  events: z.array(z.string()).describe(
    "Events to subscribe to. Examples: MESSAGES_UPSERT, MESSAGES_UPDATE, SEND_MESSAGE, CONNECTION_UPDATE, QRCODE_UPDATED, etc."
  ),
  headers: z.record(z.string()).optional().describe("Custom HTTP headers to include in webhook requests"),
};

export function registerSetWebhook(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "set_webhook",
    {
      title: "Set Webhook",
      description: "Configure the webhook for the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const webhook: Record<string, unknown> = {
          enabled: args.enabled,
          url: args.url,
          events: args.events,
        };
        if (args.byEvents !== undefined) webhook["byEvents"] = args.byEvents;
        if (args.base64 !== undefined) webhook["base64"] = args.base64;
        if (args.headers !== undefined) webhook["headers"] = args.headers;
        const data = await client.post(`/webhook/set/${client.instanceName}`, { webhook });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
