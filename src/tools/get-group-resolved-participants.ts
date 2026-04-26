import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { getPool, isDbConfigured } from "../util/db.js";

interface RawParticipant {
  id?: string;
  admin?: string | null;
  [key: string]: unknown;
}

interface RawGroupInfo {
  id?: string;
  subject?: string;
  participants?: RawParticipant[];
  [key: string]: unknown;
}

interface ResolvedRow {
  participant: string;
  participant_alt: string | null;
  push_name: string | null;
  last_seen: string | null;
}

const schema = {
  groupJid: z
    .string()
    .min(1)
    .describe("Group JID (e.g. 120363xxxxxxxx@g.us)"),
  sinceDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(180)
    .optional()
    .describe(
      "Lookback window in days for message history used to resolve LIDs. Default 180. " +
      "Larger window = more LIDs resolved but slower query."
    ),
  onlyResolved: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      "When true, omits participants without phone or pushName from response. " +
      "Useful when caller only wants actionable contacts."
    ),
};

export function registerGetGroupResolvedParticipants(
  server: McpServer,
  client: EvolutionClient,
): void {
  server.registerTool(
    "get_group_resolved_participants",
    {
      title: "Get Group Resolved Participants (LID → phone + name)",
      description:
        "Resolve a group's LID participants to phone JID + pushName by cross-referencing " +
        "the Evolution Postgres Message history (key->>'participantAlt' field). " +
        "Returns: { groupJid, total, resolved, unresolved, participants: [{ lid, phone, name, isAdmin, lastSeen }] }. " +
        "Coverage depends on how many participants sent messages in the lookback window — " +
        "silent members stay unresolved. Phone field is ready to use with send_text. " +
        "Requires EVOLUTION_DB_URL env var pointing to Evolution's Postgres.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        if (!isDbConfigured()) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  "EVOLUTION_DB_URL not configured. Set it in the MCP env to enable DB-backed " +
                  "LID resolution (e.g. postgresql://user:pass@host:5432/evolution_api).",
              },
            ],
          };
        }

        const pool = getPool();
        if (!pool) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: "Postgres pool unavailable." },
            ],
          };
        }

        const groupJid = args.groupJid;
        const sinceDays = args.sinceDays ?? 180;
        const onlyResolved = args.onlyResolved === true;

        const data = (await client.get(
          `/group/findGroupInfos/${client.instanceName}?groupJid=${encodeURIComponent(groupJid)}`,
        )) as RawGroupInfo;

        const participants: RawParticipant[] = Array.isArray(data.participants)
          ? data.participants
          : [];
        if (participants.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    groupJid,
                    subject: data.subject,
                    total: 0,
                    resolved: 0,
                    unresolved: 0,
                    participants: [],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const lidIds = participants.map((p) => p.id ?? "").filter(Boolean);

        let resolvedMap = new Map<string, ResolvedRow>();
        if (lidIds.length > 0) {
          const sql = `
            SELECT DISTINCT ON (participant)
              participant,
              participant_alt,
              push_name,
              last_seen
            FROM (
              SELECT
                key->>'participant' AS participant,
                key->>'participantAlt' AS participant_alt,
                "pushName" AS push_name,
                "messageTimestamp" AS last_seen
              FROM "Message"
              WHERE key->>'remoteJid' = $1
                AND key->>'participant' = ANY($2::text[])
                AND "messageTimestamp" > EXTRACT(EPOCH FROM (NOW() - ($3 || ' days')::interval))
                AND (key->>'participantAlt' IS NOT NULL OR "pushName" IS NOT NULL)
              ORDER BY "messageTimestamp" DESC
            ) t
            ORDER BY participant, last_seen DESC NULLS LAST
          `;
          const params: unknown[] = [groupJid, lidIds, String(sinceDays)];
          const res = await pool.query<ResolvedRow>(sql, params);
          for (const row of res.rows) {
            resolvedMap.set(row.participant, row);
          }
        }

        const enriched = participants
          .map((p) => {
            const id = p.id ?? "";
            const r = resolvedMap.get(id);
            const phoneJid = r?.participant_alt ?? null;
            const phone =
              phoneJid && phoneJid.endsWith("@s.whatsapp.net")
                ? phoneJid.split("@")[0]
                : null;
            const isLid = id.endsWith("@lid");
            const fallbackPhone =
              !isLid && id.endsWith("@s.whatsapp.net") ? id.split("@")[0] : null;
            const name =
              r?.push_name && !/^\d+$/.test(r.push_name) ? r.push_name : null;
            return {
              lid: id,
              phone: phone ?? fallbackPhone,
              name,
              isAdmin: p.admin != null && p.admin !== "",
              lastSeen: r?.last_seen ? Number(r.last_seen) : null,
            };
          })
          .filter((p) => (onlyResolved ? p.phone || p.name : true));

        const resolvedCount = enriched.filter((p) => p.phone).length;
        const namedCount = enriched.filter((p) => p.name).length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  groupJid,
                  subject: data.subject,
                  total: participants.length,
                  resolvedPhone: resolvedCount,
                  resolvedName: namedCount,
                  unresolved: participants.length - resolvedCount,
                  sinceDays,
                  participants: enriched,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        if (e instanceof McpError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: e.message }],
          };
        }
        const msg = e instanceof Error ? e.message : String(e);
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `DB resolution failed: ${msg}` },
          ],
        };
      }
    },
  );
}
