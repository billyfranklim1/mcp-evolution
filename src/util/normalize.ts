/** Shared message normalizer — prevents payload overflow from raw Evolution responses. */

interface RawMessage {
  key?: {
    id?: string;
    fromMe?: boolean;
    remoteJid?: string;
    remoteJidAlt?: string;
  };
  pushName?: string;
  messageTimestamp?: number;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    quotedMessage?: unknown;
    contextInfo?: { stanzaId?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface NormalizedMessage {
  id: string;
  fromMe: boolean;
  remoteJid: string;
  remoteJidAlt?: string;
  pushName?: string | null;
  timestamp: number;
  type: string;
  text: string | null;
  mediaKey?: string;
  quotedMessageId?: string;
}

/** Infer MIME extension — returns e.g. "jpg", "mp4", "ogg". Falls back to "bin". */
export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "application/zip": "zip",
  };
  const sub = mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "");
  return map[mime] ?? (sub !== undefined && sub.length > 0 ? sub : "bin");
}

const CONTENT_TYPES = [
  "conversation",
  "extendedTextMessage",
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
  "contactMessage",
  "contactsArrayMessage",
  "locationMessage",
  "liveLocationMessage",
  "reactionMessage",
  "pollCreationMessage",
  "buttonsMessage",
  "listMessage",
] as const;

const MEDIA_TYPES = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
]);

/** Prefer real content keys over wrappers like mediaUrl / messageContextInfo. */
function detectMessageType(msg: Record<string, unknown>): string {
  for (const key of CONTENT_TYPES) {
    if (key in msg && msg[key] != null) {
      return key;
    }
  }
  const fallback = Object.keys(msg).find(
    (k) => k !== "contextInfo" && k !== "messageContextInfo" && k !== "senderKeyDistributionMessage"
  );
  return fallback ?? "unknown";
}

function extractCaption(msg: Record<string, unknown>, type: string): string | null {
  if (typeof msg.conversation === "string") {
    return msg.conversation;
  }
  const extended = msg.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) {
    return extended.text;
  }

  // Captions live on the media object even when mediaUrl is also present
  for (const mediaKey of MEDIA_TYPES) {
    const part = msg[mediaKey] as { caption?: string } | undefined;
    if (part?.caption) {
      return part.caption;
    }
  }

  const typed = msg[type] as { caption?: string; text?: string } | string | undefined;
  if (typed && typeof typed === "object") {
    return typed.caption ?? typed.text ?? null;
  }
  return null;
}

/** Normalize a raw Evolution message object to the compact, bounded shape. */
export function normalizeMessage(raw: RawMessage): NormalizedMessage {
  const key = raw.key ?? {};
  const msg = (raw.message ?? {}) as Record<string, unknown>;

  const type = detectMessageType(msg);
  const isMedia = MEDIA_TYPES.has(type);
  const text = extractCaption(msg, type);
  const msgObj = msg[type] as Record<string, unknown> | undefined;

  // Quoted message ID lives in contextInfo.stanzaId
  const contextInfo = (msgObj as { contextInfo?: { stanzaId?: string } } | undefined)?.contextInfo
    ?? ((msg.contextInfo as { stanzaId?: string } | undefined));
  const quotedMessageId = contextInfo?.stanzaId;

  const result: NormalizedMessage = {
    id: key.id ?? "",
    fromMe: key.fromMe ?? false,
    remoteJid: key.remoteJid ?? "",
    timestamp: raw.messageTimestamp ?? 0,
    type,
    text,
  };

  if (key.remoteJidAlt) {
    result.remoteJidAlt = key.remoteJidAlt;
  }
  if (raw.pushName !== undefined) {
    result.pushName = raw.pushName;
  }

  // Only attach mediaKey when this is a media message — id doubles as download handle
  if (isMedia && key.id) result.mediaKey = key.id;
  if (quotedMessageId) result.quotedMessageId = quotedMessageId;

  return result;
}
