import type { EvolutionClient } from "../evolution-client.js";
import { extractMessages } from "./extract-messages.js";
import { resolveRelatedJids } from "./jid.js";
import { normalizeMessage, type NormalizedMessage } from "./normalize.js";

async function fetchMessagesForJid(
  client: EvolutionClient,
  remoteJid: string,
  limit: number
): Promise<NormalizedMessage[]> {
  const payload = {
    where: { key: { remoteJid } },
    limit,
    offset: 0,
  };
  const data = await client.post(`/chat/findMessages/${client.instanceName}`, payload);
  return extractMessages(data).map((raw) =>
    normalizeMessage(raw as Parameters<typeof normalizeMessage>[0])
  );
}

/**
 * Lightweight: one findMessages call for a single JID (no LID resolve / no findChats).
 * Use for displayName enrichment to avoid N+1 chat list fetches.
 */
export async function peekInboundPushName(
  client: EvolutionClient,
  remoteJid: string,
  limit = 20
): Promise<string | null> {
  const weak = new Set(["você", "voce", "you", "tu"]);
  try {
    const msgs = await fetchMessagesForJid(client, remoteJid, limit);
    const inbound = msgs.find(
      (m) => !m.fromMe && m.pushName && !weak.has(m.pushName.trim().toLowerCase())
    );
    return inbound?.pushName?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch messages for a JID, also querying LID/phone alternates, then dedupe by id.
 */
export async function fetchNormalizedMessages(
  client: EvolutionClient,
  remoteJid: string,
  limit: number,
  offset: number
): Promise<NormalizedMessage[]> {
  const jids = await resolveRelatedJids(client, remoteJid);
  const byId = new Map<string, NormalizedMessage>();

  for (const jid of jids) {
    for (const normalized of await fetchMessagesForJid(client, jid, limit + offset)) {
      if (!normalized.id) {
        continue;
      }
      if (!byId.has(normalized.id)) {
        byId.set(normalized.id, normalized);
      }
    }
  }

  const all = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
  return all.slice(offset, offset + limit);
}
