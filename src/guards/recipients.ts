import { ConfigError, GuardError } from "../errors.js";

/**
 * Recipient allowlist.
 *
 * Values are compared by their numeric identity: the local part before "@" (without a
 * ":device" suffix), digits only. Accepted forms: "5511999999999", "+55 (11) 99999-9999",
 * "5511999999999@s.whatsapp.net", "...@c.us", "123456789012345@lid", "120363...@g.us".
 * Brazilian mobiles: list them in full (55 DD 9XXXXXXXX); a legacy JID without the extra "9"
 * (55 DD XXXXXXXX@s.whatsapp.net, common for area codes >= 31) is then matched too.
 */
export type RecipientRule = { unrestricted: true } | { unrestricted: false; keys: ReadonlySet<string> };

const PHONE_DOMAINS = new Set(["", "s.whatsapp.net", "c.us"]);
const OTHER_DOMAINS = new Set(["lid", "g.us"]);

/** Keys that identify a chat/recipient anywhere inside tool arguments. */
const RECIPIENT_KEYS = new Set([
  "number",
  "numbers",
  "remoteJid",
  "jid",
  "groupJid",
  "chat",
  "participants",
  "statusJidList",
]);

/** Returns the comparable keys for a recipient value, or null if it is not a recognisable id. */
export function recipientKeys(value: string): string[] | null {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  const local = at === -1 ? trimmed : trimmed.slice(0, at);
  const domain = at === -1 ? "" : trimmed.slice(at + 1);
  if (!PHONE_DOMAINS.has(domain) && !OTHER_DOMAINS.has(domain)) return null;

  const digits = local.split(":")[0]!.replace(/\D/g, "");
  if (!digits) return null;

  const keys = [digits];
  if (PHONE_DOMAINS.has(domain)) {
    // Legacy BR JID without the mobile "9" (55 DD XXXXXXXX) also matches 55 DD 9XXXXXXXX.
    // One direction only, so a 12-digit (landline) entry never admits a 13-digit mobile.
    const legacy = /^55(\d{2})(\d{8})$/.exec(digits);
    if (legacy) keys.push(`55${legacy[1]}9${legacy[2]}`);
  }
  return keys;
}

/** Canonical (digits-only) form, or null. */
export function normalizeRecipient(value: string): string | null {
  return recipientKeys(value)?.[0] ?? null;
}

/**
 * Env var name holding the per-instance override:
 * EVOLUTION_ALLOWED_RECIPIENTS__ + instance upper-cased with every non [A-Z0-9] char → "_".
 * e.g. "billy-franklim.2" → EVOLUTION_ALLOWED_RECIPIENTS__BILLY_FRANKLIM_2
 */
export function recipientEnvName(instance: string): string {
  return `EVOLUTION_ALLOWED_RECIPIENTS__${instance.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/** Parse a comma-separated allowlist. "*" means unrestricted. */
export function parseRecipientList(raw: string, envName: string): RecipientRule {
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (entries.length === 1 && entries[0] === "*") return { unrestricted: true };

  const keys = new Set<string>();
  for (const entry of entries) {
    // Store only the canonical form; Brazilian 9-digit variants are expanded on the
    // value side, and only for phone JIDs (never for @lid / @g.us).
    const k = normalizeRecipient(entry);
    if (!k) throw new ConfigError(`${envName} has an invalid entry "${entry}"`);
    keys.add(k);
  }
  if (keys.size === 0) throw new ConfigError(`${envName} is set but lists no recipients`);
  return { unrestricted: false, keys };
}

export class RecipientPolicy {
  constructor(private readonly rule?: RecipientRule) {}

  get restricted(): boolean {
    return this.rule !== undefined && !this.rule.unrestricted;
  }

  isAllowed(value: string | undefined | null): boolean {
    if (!this.rule || this.rule.unrestricted) return true;
    if (!value) return false;
    const keys = recipientKeys(value);
    const allowed = this.rule.keys;
    return keys !== null && keys.some((k) => allowed.has(k));
  }

  assertAllowed(values: string[]): void {
    for (const v of values) {
      if (!this.isAllowed(v)) {
        throw new GuardError(
          `Recipient "${v}" is not allowed for this instance (EVOLUTION_ALLOWED_RECIPIENTS).`
        );
      }
    }
  }
}

/** Recursively collect every recipient-like value from tool arguments. */
export function collectRecipients(args: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown, key?: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, key));
      return;
    }
    if (typeof node === "string") {
      if (key !== undefined && RECIPIENT_KEYS.has(key)) out.push(node);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) visit(v, k);
    }
  };
  visit(args);
  return out;
}

/** Enforce the recipient allowlist for one tool call. No-op when unrestricted. */
export function enforceRecipients(tool: string, args: Record<string, unknown>, policy: RecipientPolicy): void {
  if (!policy.restricted) return;

  if (tool === "accept_invite") {
    throw new GuardError("accept_invite is not available while EVOLUTION_ALLOWED_RECIPIENTS is set.");
  }
  if (tool === "send_status") {
    const list = args["statusJidList"];
    if (!Array.isArray(list) || list.length === 0) {
      throw new GuardError(
        "send_status requires an explicit statusJidList while EVOLUTION_ALLOWED_RECIPIENTS is set."
      );
    }
  }
  policy.assertAllowed(collectRecipients(args));
}
