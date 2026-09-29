import { describe, it, expect, vi, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../src/config.js";
import { ConfigError } from "../src/errors.js";
import { createServer } from "../src/server.js";
import { ALL_TOOLS, DANGEROUS_TOOLS, TOOL_GROUPS } from "../src/guards/tools.js";
import { normalizeRecipient, recipientEnvName, RecipientPolicy, parseRecipientList } from "../src/guards/recipients.js";
import { createRedactor, REDACTED } from "../src/util/redact.js";

const API_KEY = "sk-super-secret-apikey-123";
const BASIC_USER_PASS = "nginxuser:nginx-p4ssw0rd";
const BASIC = Buffer.from(BASIC_USER_PASS).toString("base64");

const BASE_ENV = {
  EVOLUTION_API_URL: "http://evo.local:8080",
  EVOLUTION_API_KEY: API_KEY,
};

type Env = Record<string, string>;

function fetchOk(body: unknown = { ok: true }) {
  return vi.fn().mockImplementation(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  }));
}

async function connect(env: Env) {
  const server = createServer(loadConfig({ ...BASE_ENV, ...env }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function toolNames(env: Env): Promise<string[]> {
  const c = await connect(env);
  return (await c.listTools()).tools.map((t) => t.name).sort();
}

function text(res: unknown): string {
  const r = res as { content: Array<{ type: string; text: string }> };
  return r.content.map((c) => c.text).join("\n");
}

function calledUrl(mock: ReturnType<typeof vi.fn>, i = 0): string {
  return mock.mock.calls[i]![0] as string;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Instances ────────────────────────────────────────────────────────────────

describe("instances", () => {
  it("single EVOLUTION_INSTANCE keeps legacy behaviour (no instance param)", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCE: "solo" });

    const sendText = (await c.listTools()).tools.find((t) => t.name === "send_text")!;
    expect(Object.keys(sendText.inputSchema.properties ?? {})).not.toContain("instance");

    const res = await c.callTool({ name: "send_text", arguments: { number: "5511999999999", text: "hi" } });
    expect(res.isError).toBeFalsy();
    expect(calledUrl(f)).toBe("http://evo.local:8080/message/sendText/solo");
  });

  it("single entry in EVOLUTION_INSTANCES is the implicit default", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCES: "only" });
    await c.callTool({ name: "connection_state", arguments: {} });
    expect(calledUrl(f)).toBe("http://evo.local:8080/instance/connectionState/only");
  });

  it("multiple instances with EVOLUTION_DEFAULT_INSTANCE", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCES: "alpha, beta", EVOLUTION_DEFAULT_INSTANCE: "beta" });

    const sendText = (await c.listTools()).tools.find((t) => t.name === "send_text")!;
    const prop = (sendText.inputSchema.properties as Record<string, { enum?: string[] }>)["instance"];
    expect(prop?.enum).toEqual(["alpha", "beta"]);
    expect(sendText.inputSchema.required ?? []).not.toContain("instance");

    await c.callTool({ name: "send_text", arguments: { number: "5511999999999", text: "x" } });
    expect(calledUrl(f, 0)).toBe("http://evo.local:8080/message/sendText/beta");

    await c.callTool({ name: "send_text", arguments: { number: "5511999999999", text: "x", instance: "alpha" } });
    expect(calledUrl(f, 1)).toBe("http://evo.local:8080/message/sendText/alpha");
  });

  it("multiple instances without default require `instance`", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCES: "alpha,beta" });

    const res = await c.callTool({ name: "connection_state", arguments: {} });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/instance/);
    expect(f).not.toHaveBeenCalled();

    const ok = await c.callTool({ name: "connection_state", arguments: { instance: "alpha" } });
    expect(ok.isError).toBeFalsy();
    expect(calledUrl(f)).toBe("http://evo.local:8080/instance/connectionState/alpha");
  });

  it("rejects an instance outside the allowlist without calling the API", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCES: "alpha,beta", EVOLUTION_DEFAULT_INSTANCE: "alpha" });
    const res = await c.callTool({
      name: "send_text",
      arguments: { number: "5511999999999", text: "x", instance: "../evil" },
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/not configured/);
    expect(f).not.toHaveBeenCalled();
  });

  it("list_instances returns names, default and optional state", async () => {
    const f = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ instance: { state: url.endsWith("/alpha") ? "open" : "close" } }),
    }));
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCES: "alpha,beta", EVOLUTION_DEFAULT_INSTANCE: "alpha" });

    const listTool = (await c.listTools()).tools.find((t) => t.name === "list_instances")!;
    expect(Object.keys(listTool.inputSchema.properties ?? {})).not.toContain("instance");

    const plain = JSON.parse(text(await c.callTool({ name: "list_instances", arguments: {} })));
    expect(plain).toEqual({
      instances: [
        { name: "alpha", default: true },
        { name: "beta", default: false },
      ],
    });
    expect(f).not.toHaveBeenCalled();

    const withState = JSON.parse(
      text(await c.callTool({ name: "list_instances", arguments: { includeState: true } }))
    );
    expect(withState.instances).toEqual([
      { name: "alpha", default: true, state: "open" },
      { name: "beta", default: false, state: "close" },
    ]);
  });

  it("config validation", () => {
    expect(() => loadConfig({ ...BASE_ENV })).toThrow(ConfigError);
    expect(() => loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCE: "a", EVOLUTION_INSTANCES: "a,b" })).toThrow(
      /not both/
    );
    expect(() =>
      loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCES: "a,b", EVOLUTION_DEFAULT_INSTANCE: "c" })
    ).toThrow(/EVOLUTION_DEFAULT_INSTANCE/);
    expect(() => loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCES: "a/b" })).toThrow(/Invalid instance/);
    expect(() => loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCES: "my-inst,my.inst" })).toThrow(
      /same variable EVOLUTION_ALLOWED_RECIPIENTS__MY_INST/
    );
    const cfg = loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCES: " a , b ,a" });
    expect(cfg.instances).toEqual(["a", "b"]);
    expect(cfg.defaultInstance).toBeUndefined();
  });
});

// ─── Tool allowlist ───────────────────────────────────────────────────────────

describe("EVOLUTION_ALLOWED_TOOLS", () => {
  it("hides dangerous tools by default and exposes the rest", async () => {
    const names = await toolNames({ EVOLUTION_INSTANCE: "a" });
    for (const t of DANGEROUS_TOOLS) expect(names).not.toContain(t);
    expect(names).toEqual([...TOOL_GROUPS["@default"]!].sort());
    expect(names).toContain("send_text");
    expect(names).toContain("list_instances");
  });

  it("supports @read + @send groups", async () => {
    const names = await toolNames({ EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_TOOLS: "@read,@send" });
    const expected = new Set([...TOOL_GROUPS["@read"]!, ...TOOL_GROUPS["@send"]!]);
    expect(names).toEqual([...expected].sort());
    expect(names).not.toContain("send_sticker");
    expect(names).not.toContain("send_status");
  });

  it("re-enables a dangerous tool only when listed explicitly", async () => {
    const names = await toolNames({ EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_TOOLS: "send_text, send_status" });
    expect(names).toEqual(["send_status", "send_text"]);

    const all = await toolNames({ EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_TOOLS: "@default,@dangerous" });
    expect(all).toEqual([...ALL_TOOLS].sort());
  });

  it("a hidden tool cannot be called", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCE: "a" });
    const res = await c.callTool({ name: "logout_instance", arguments: {} });
    expect(res.isError).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects unknown tool names and groups at startup", () => {
    expect(() => loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_TOOLS: "send_txt" })).toThrow(
      /send_txt/
    );
    expect(() => loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_TOOLS: "@nope" })).toThrow(
      /@nope/
    );
  });
});

// ─── Recipient allowlist ──────────────────────────────────────────────────────

describe("recipient normalization", () => {
  it("normalizes phone, JID, LID and group forms to digits", () => {
    expect(normalizeRecipient("5511952136666")).toBe("5511952136666");
    expect(normalizeRecipient("+55 (11) 95213-6666")).toBe("5511952136666");
    expect(normalizeRecipient("5511952136666@s.whatsapp.net")).toBe("5511952136666");
    expect(normalizeRecipient("5511952136666:12@s.whatsapp.net")).toBe("5511952136666");
    expect(normalizeRecipient("123456789012345@lid")).toBe("123456789012345");
    expect(normalizeRecipient("120363000000000000@g.us")).toBe("120363000000000000");
    expect(normalizeRecipient("status@broadcast")).toBeNull();
    expect(normalizeRecipient("abc")).toBeNull();
  });

  it("matches Brazilian mobiles with and without the extra 9", () => {
    const p = new RecipientPolicy(parseRecipientList("5511952136666", "X"));
    expect(p.isAllowed("551152136666@s.whatsapp.net")).toBe(true);
    expect(p.isAllowed("5511952136666@s.whatsapp.net")).toBe(true);
    expect(p.isAllowed("5511952136667")).toBe(false);
    // a 12-digit (landline) entry never admits the 13-digit mobile
    const landline = new RecipientPolicy(parseRecipientList("551132221111", "X"));
    expect(landline.isAllowed("551132221111@s.whatsapp.net")).toBe(true);
    expect(landline.isAllowed("5511932221111@s.whatsapp.net")).toBe(false);
    // the 9-variant does not apply to LIDs
    expect(p.isAllowed("551152136666@lid")).toBe(false);
  });

  it("builds the per-instance env name", () => {
    expect(recipientEnvName("billyfranklim")).toBe("EVOLUTION_ALLOWED_RECIPIENTS__BILLYFRANKLIM");
    expect(recipientEnvName("billy-franklim.2")).toBe("EVOLUTION_ALLOWED_RECIPIENTS__BILLY_FRANKLIM_2");
  });

  it("rejects invalid allowlist entries at startup", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_RECIPIENTS: "5511,foo@bar.com" })
    ).toThrow(/invalid entry/);
  });
});

describe("EVOLUTION_ALLOWED_RECIPIENTS", () => {
  const ALLOWED = "5511952136666";
  const LID = "987654321012345@lid";
  const env = {
    EVOLUTION_INSTANCE: "a",
    EVOLUTION_ALLOWED_RECIPIENTS: `${ALLOWED}, ${LID}, 120363000000000001@g.us`,
  };

  it("accepts allowed recipients in any accepted format", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect(env);
    for (const number of [ALLOWED, `${ALLOWED}@s.whatsapp.net`, "987654321012345@lid", "120363000000000001@g.us"]) {
      const res = await c.callTool({ name: "send_text", arguments: { number, text: "ok" } });
      expect(res.isError, number).toBeFalsy();
    }
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("*@g.us admits every group but keeps direct chats restricted", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_RECIPIENTS: `${ALLOWED},*@g.us` });
    const group = await c.callTool({ name: "send_text", arguments: { number: "120363999999999999@g.us", text: "ok" } });
    expect(group.isError).toBeFalsy();
    const direct = await c.callTool({ name: "send_text", arguments: { number: ALLOWED, text: "ok" } });
    expect(direct.isError).toBeFalsy();
    const other = await c.callTool({ name: "send_text", arguments: { number: "5511999999999", text: "no" } });
    expect(other.isError).toBe(true);
    const bareDigits = await c.callTool({ name: "send_text", arguments: { number: "120363999999999999", text: "no" } });
    expect(bareDigits.isError).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("accepts *@g.us as the only entry", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, EVOLUTION_INSTANCE: "a", EVOLUTION_ALLOWED_RECIPIENTS: "*@g.us" })
    ).not.toThrow();
  });

  it("rejects other recipients without leaking the allowlist", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect(env);
    const res = await c.callTool({ name: "send_text", arguments: { number: "5511999999999", text: "no" } });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/not allowed/);
    expect(text(res)).not.toContain(ALLOWED);
    expect(f).not.toHaveBeenCalled();
  });

  it("checks nested and array recipient fields", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect(env);

    const nested = await c.callTool({
      name: "mark_as_read",
      arguments: { readMessages: [{ remoteJid: "5511000000000@s.whatsapp.net", fromMe: false, id: "X" }] },
    });
    expect(nested.isError).toBe(true);

    const arr = await c.callTool({ name: "check_number", arguments: { numbers: [ALLOWED, "5511000000000"] } });
    expect(arr.isError).toBe(true);

    const read = await c.callTool({ name: "find_messages", arguments: { remoteJid: "5511000000000@s.whatsapp.net" } });
    expect(read.isError).toBe(true);

    const group = await c.callTool({ name: "get_group_info", arguments: { groupJid: "120363999999999999@g.us" } });
    expect(group.isError).toBe(true);

    expect(f).not.toHaveBeenCalled();
  });

  it("filters listing results to the allowlist", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk([
        { remoteJid: `${ALLOWED}@s.whatsapp.net`, pushName: "Test" },
        { remoteJid: "5511000000000@s.whatsapp.net", pushName: "Other" },
        { remoteJid: LID, pushName: "Lid" },
      ])
    );
    const c = await connect(env);
    const chats = JSON.parse(text(await c.callTool({ name: "find_chats", arguments: {} }))) as Array<{
      remoteJid: string;
    }>;
    expect(chats.map((x) => x.remoteJid)).toEqual([`${ALLOWED}@s.whatsapp.net`, LID]);
  });

  it("send_status needs an explicit, allowed statusJidList", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ ...env, EVOLUTION_ALLOWED_TOOLS: "send_status" });
    const broadcast = await c.callTool({ name: "send_status", arguments: { type: "text", content: "hi" } });
    expect(broadcast.isError).toBe(true);
    expect(text(broadcast)).toMatch(/statusJidList/);
    const targeted = await c.callTool({
      name: "send_status",
      arguments: { type: "text", content: "hi", statusJidList: [`${ALLOWED}@s.whatsapp.net`] },
    });
    expect(targeted.isError).toBeFalsy();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("per-instance override replaces the global list for that instance", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({
      EVOLUTION_INSTANCES: "alpha,beta-2,gamma",
      EVOLUTION_DEFAULT_INSTANCE: "alpha",
      EVOLUTION_ALLOWED_RECIPIENTS: "5511111111111",
      "EVOLUTION_ALLOWED_RECIPIENTS__BETA_2": "5522222222222",
      EVOLUTION_ALLOWED_RECIPIENTS__GAMMA: "*",
    });
    const send = (number: string, instance: string) =>
      c.callTool({ name: "send_text", arguments: { number, text: "x", instance } });

    expect((await send("5511111111111", "alpha")).isError).toBeFalsy();
    expect((await send("5522222222222", "alpha")).isError).toBe(true);
    expect((await send("5522222222222@s.whatsapp.net", "beta-2")).isError).toBeFalsy();
    expect((await send("5511111111111", "beta-2")).isError).toBe(true);
    expect((await send("5599999999999", "gamma")).isError).toBeFalsy();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not restrict when unset", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    const c = await connect({ EVOLUTION_INSTANCE: "a" });
    const res = await c.callTool({ name: "send_text", arguments: { number: "5511000000000", text: "x" } });
    expect(res.isError).toBeFalsy();
  });
});

// ─── Secret redaction ─────────────────────────────────────────────────────────

describe("secret redaction", () => {
  const env = {
    EVOLUTION_INSTANCE: "a",
    EVOLUTION_BASIC_AUTH: BASIC,
    EVOLUTION_DB_URL: "postgresql://dbuser:db-s3cret-pw@db.local:5432/evolution",
  };
  const SECRETS = [API_KEY, BASIC, BASIC_USER_PASS, "nginx-p4ssw0rd", "db-s3cret-pw"];

  it("masks secrets echoed back in Evolution API error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          `invalid apikey ${API_KEY}; auth=Basic ${BASIC}; user ${BASIC_USER_PASS}; db=db-s3cret-pw`,
      })
    );
    const c = await connect(env);
    const res = await c.callTool({ name: "connection_state", arguments: {} });
    expect(res.isError).toBe(true);
    const out = text(res);
    for (const s of SECRETS) expect(out).not.toContain(s);
    expect(out).toContain(REDACTED);
    expect(out).toContain("401");
  });

  it("masks secrets in network errors and in successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`connect ECONNREFUSED apikey=${API_KEY}`)));
    const c = await connect(env);
    const err = await c.callTool({ name: "connection_state", arguments: {} });
    expect(err.isError).toBe(true);
    expect(text(err)).not.toContain(API_KEY);

    vi.stubGlobal("fetch", fetchOk({ webhook: { headers: { apikey: API_KEY } } }));
    const ok = await c.callTool({ name: "find_webhook", arguments: {} });
    expect(text(ok)).not.toContain(API_KEY);
    expect(text(ok)).toContain(REDACTED);
  });

  it("config errors never print secret values", () => {
    try {
      loadConfig({ EVOLUTION_API_URL: "not a url", EVOLUTION_API_KEY: API_KEY, EVOLUTION_INSTANCE: "a" });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(API_KEY);
    }
  });

  it("createRedactor ignores tiny values and handles URL-encoded secrets", () => {
    const r = createRedactor({ apiKey: "abc", dbUrl: "postgres://u:p%40ss%2Fword@h/db" });
    expect(r("abc stays")).toBe("abc stays");
    expect(r("pw p@ss/word and p%40ss%2Fword")).not.toMatch(/p@ss\/word|p%40ss%2Fword/);
  });
});
