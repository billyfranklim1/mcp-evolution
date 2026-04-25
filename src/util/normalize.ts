/** Shared message normalizer — prevents payload overflow from raw Evolution responses. */

interface RawMessage {
  key?: {
    id?: string;
    fromMe?: boolean;
    remoteJid?: string;
  };
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

/** Normalize a raw Evolution message object to the compact, bounded shape. */
export function normalizeMessage(raw: RawMessage): NormalizedMessage {
  const key = raw.key ?? {};
  const msg = raw.message ?? {};

  // Detect media types by checking which message type key exists
  const MEDIA_TYPES = new Set(["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"]);
  const type = Object.keys(msg).find((k) => k !== "contextInfo") ?? "unknown";
  const isMedia = MEDIA_TYPES.has(type);

  // Extract text from whichever message field is present
  const msgObj = msg[type] as Record<string, unknown> | undefined;
  const text: string | null =
    (msg.conversation as string | undefined) ??
    (msg.extendedTextMessage?.text as string | undefined) ??
    ((msgObj as { caption?: string } | undefined)?.caption) ??
    null;

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

  // Only attach mediaKey when this is a media message — id doubles as download handle
  if (isMedia && key.id) result.mediaKey = key.id;
  if (quotedMessageId) result.quotedMessageId = quotedMessageId;

  return result;
}
