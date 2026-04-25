import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

interface RawParticipant {
  id?: string;
  admin?: string | null;
  [key: string]: unknown;
}

interface RawGroupInfo {
  id?: string;
  subject?: string;
  subjectOwner?: string;
  subjectTime?: number;
  participants?: RawParticipant[];
  desc?: string;
  descId?: string;
  creation?: number;
  owner?: string;
  [key: string]: unknown;
}

const schema = {
  groupJid: z
    .string()
    .min(1)
    .describe("The group JID (e.g. 120363xxxxxxxx@g.us)"),
  includeParticipants: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      "When true, includes the full participant list in the response (may be large for big groups). " +
      "Default false returns only admins + size, which covers 95% of use cases."
    ),
};

export function registerGetGroupInfo(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "get_group_info",
    {
      title: "Get Group Info",
      description:
        "Get detailed info for a specific WhatsApp group. " +
        "By default returns { id, subject, subjectOwner, subjectTime, size, desc, descId, creation, owner, admins } — " +
        "participant list is dropped to prevent payload overflow. " +
        "Set includeParticipants=true to get the full list (use sparingly for large groups).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get(
          `/group/findGroupInfos/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`
        ) as RawGroupInfo;

        const participants: RawParticipant[] = Array.isArray(data.participants) ? data.participants : [];

        const admins = participants
          .filter((p) => p.admin != null && p.admin !== "")
          .map((p) => ({ jid: p.id ?? "", admin: p.admin }));

        const normalized: Record<string, unknown> = {
          id: data.id,
          subject: data.subject,
          subjectOwner: data.subjectOwner,
          subjectTime: data.subjectTime,
          size: participants.length,
          desc: data.desc,
          descId: data.descId,
          creation: data.creation,
          owner: data.owner,
          admins,
        };

        if (args.includeParticipants) {
          // Full list — only expose id and admin role
          normalized["participants"] = participants.map((p) => ({ jid: p.id, admin: p.admin ?? null }));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }],
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
