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
  inviteCode: z.string().min(1).describe("Group invite code (the part after https://chat.whatsapp.com/)"),
  includeParticipants: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      "When true, includes the full participant list in the response (may be large for big groups). " +
      "Default false returns only admins + size, which covers 95% of use cases."
    ),
};

export function registerFindGroupByInvite(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_group_by_invite",
    {
      title: "Find Group by Invite",
      description:
        "Get group information from an invite code without joining via the pinned instance. " +
        "Returns { id, subject, subjectOwner, subjectTime, size, desc, descId, creation, owner, admins } by default. " +
        "Set includeParticipants=true to also get the full participant list.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get(
          `/group/inviteInfo/${client.instanceName}?inviteCode=${encodeURIComponent(args.inviteCode)}`
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
          normalized["participants"] = participants.map((p) => ({ jid: p.id, admin: p.admin ?? null }));
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
