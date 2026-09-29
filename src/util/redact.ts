/** Secret redaction for anything that may be returned to the MCP client or logged. */

export const REDACTED = "[REDACTED]";

export type Redactor = (text: string) => string;

export interface SecretSources {
  apiKey?: string;
  basicAuth?: string;
  dbUrl?: string;
  apiUrl?: string;
}

function urlSecrets(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const u = new URL(raw);
    const out: string[] = [];
    if (u.password) out.push(u.password, decodeURIComponent(u.password));
    if (u.password || u.username) out.push(`${u.username}:${u.password}@`);
    return out;
  } catch {
    return [];
  }
}

/** Build a redactor that masks the API key, Basic Auth (raw and decoded) and URL passwords. */
export function createRedactor(src: SecretSources): Redactor {
  const secrets = new Set<string>();
  const add = (s: string | undefined): void => {
    if (!s || s.length < 4) return;
    secrets.add(s);
    secrets.add(encodeURIComponent(s));
  };

  add(src.apiKey);
  if (src.basicAuth) {
    add(src.basicAuth);
    try {
      const decoded = Buffer.from(src.basicAuth, "base64").toString("utf8");
      // Only treat it as credentials if it looks like "user:pass"
      if (/^[^:\s]+:\S+$/.test(decoded)) {
        add(decoded);
        add(decoded.slice(decoded.indexOf(":") + 1));
      }
    } catch {
      /* not base64 — raw value already covered */
    }
  }
  urlSecrets(src.dbUrl).forEach(add);
  urlSecrets(src.apiUrl).forEach(add);
  add(src.dbUrl);

  const ordered = [...secrets].sort((a, b) => b.length - a.length);
  return (text: string): string => {
    let out = text;
    for (const s of ordered) out = out.split(s).join(REDACTED);
    return out;
  };
}
