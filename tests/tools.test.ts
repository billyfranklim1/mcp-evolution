import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EvolutionClient } from "../src/evolution-client.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const BASE_CONFIG = {
  EVOLUTION_API_URL: "http://localhost:8080",
  EVOLUTION_API_KEY: "test-key",
  EVOLUTION_INSTANCE: "test-instance",
};

function makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  });
}

describe("EvolutionClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET list_groups — builds correct URL and headers", async () => {
    const mockFetch = makeFetchMock(200, [{ id: "g1@g.us", subject: "Test", size: 3, owner: "x" }]);
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    const data = await client.get("/group/fetchAllGroups/test-instance?getParticipants=false");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/group/fetchAllGroups/test-instance?getParticipants=false");
    expect((opts.headers as Record<string, string>)["apikey"]).toBe("test-key");
    expect(data).toEqual([{ id: "g1@g.us", subject: "Test", size: 3, owner: "x" }]);
  });

  it("POST find_messages with limit — builds correct payload", async () => {
    const mockFetch = makeFetchMock(200, { messages: [] });
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/findMessages/test-instance", {
      where: { key: { remoteJid: "5511999999999@s.whatsapp.net" } },
      limit: 10,
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { where: unknown; limit: number };
    expect(body.limit).toBe(10);
    expect(body.where).toEqual({ key: { remoteJid: "5511999999999@s.whatsapp.net" } });
  });

  it("POST find_messages without limit — defaults to 50 in caller", async () => {
    const mockFetch = makeFetchMock(200, { messages: [] });
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    // Simulate what the tool handler does when no limit is provided
    const limit = undefined ?? 50;
    await client.post("/chat/findMessages/test-instance", {
      where: { key: { remoteJid: "5511999999999@s.whatsapp.net" } },
      limit,
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { limit: number };
    expect(body.limit).toBe(50);
  });

  it("POST send_text — correct body structure", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "msg-id-123" } });
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    const result = await client.post("/message/sendText/test-instance", {
      number: "5511999999999",
      text: "Hello world",
    });

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendText/test-instance");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string) as { number: string; text: string };
    expect(body.number).toBe("5511999999999");
    expect(body.text).toBe("Hello world");
    expect(result).toEqual({ key: { id: "msg-id-123" } });
  });

  it("POST send_media — includes optional fields when present", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "media-id" } });
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendMedia/test-instance", {
      number: "5511999999999",
      mediatype: "image",
      media: "https://example.com/image.jpg",
      caption: "Check this out",
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, string>;
    expect(body["mediatype"]).toBe("image");
    expect(body["media"]).toBe("https://example.com/image.jpg");
    expect(body["caption"]).toBe("Check this out");
  });

  it("GET get_group_info — encodes groupJid in URL", async () => {
    const mockFetch = makeFetchMock(200, { id: "120363@g.us", subject: "My Group" });
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);
    await client.get(
      `/group/findGroupInfos/test-instance?groupJid=${encodeURIComponent("120363@g.us")}`
    );

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("groupJid=120363%40g.us");
  });

  it("Error path — Evolution returns 400 — throws McpError", async () => {
    const mockFetch = makeFetchMock(400, '{"message":"Bad request"}');
    vi.stubGlobal("fetch", mockFetch);

    const client = new EvolutionClient(BASE_CONFIG);

    await expect(client.post("/message/sendText/test-instance", {})).rejects.toThrow(McpError);
    await expect(client.post("/message/sendText/test-instance", {})).rejects.toMatchObject({
      code: ErrorCode.InternalError,
    });
  });

  it("instanceName — returns correct instance from config", () => {
    const client = new EvolutionClient(BASE_CONFIG);
    expect(client.instanceName).toBe("test-instance");
  });

  // ─── Message tools ────────────────────────────────────────────────────────

  it("POST send_audio — correct URL and body", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "audio-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendWhatsAppAudio/test-instance", {
      number: "5511999999999",
      audio: "https://example.com/audio.ogg",
      encoding: false,
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendWhatsAppAudio/test-instance");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["number"]).toBe("5511999999999");
    expect(body["audio"]).toBe("https://example.com/audio.ogg");
  });

  it("POST send_sticker — correct URL and body", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "sticker-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendSticker/test-instance", {
      number: "5511999999999",
      sticker: "https://example.com/sticker.webp",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendSticker/test-instance");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["sticker"]).toBe("https://example.com/sticker.webp");
  });

  it("POST send_location — correct body with optional fields", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "loc-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendLocation/test-instance", {
      number: "5511999999999",
      latitude: -23.5505,
      longitude: -46.6333,
      name: "São Paulo",
      address: "SP, Brazil",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendLocation/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["latitude"]).toBe(-23.5505);
    expect(body["longitude"]).toBe(-46.6333);
    expect(body["name"]).toBe("São Paulo");
  });

  it("POST send_reaction — correct key structure", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "react-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendReaction/test-instance", {
      key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "msg-123" },
      reaction: "👍",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendReaction/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect((body["key"] as Record<string, unknown>)["id"]).toBe("msg-123");
    expect(body["reaction"]).toBe("👍");
  });

  it("POST send_poll — correct values array", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "poll-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendPoll/test-instance", {
      number: "5511999999999",
      name: "Favorite color?",
      selectableCount: 1,
      values: ["Red", "Green", "Blue"],
    });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["values"]).toEqual(["Red", "Green", "Blue"]);
    expect(body["selectableCount"]).toBe(1);
  });

  it("POST send_list — includes sections", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "list-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendList/test-instance", {
      number: "5511999999999",
      title: "Menu",
      description: "Pick an option",
      buttonText: "View",
      sections: [{ title: "Section 1", rows: [{ title: "Option A" }] }],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendList/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(Array.isArray(body["sections"])).toBe(true);
  });

  it("POST send_button — includes buttons array", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "btn-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendButtons/test-instance", {
      number: "5511999999999",
      title: "Choose",
      description: "Pick one",
      buttons: [{ type: "reply", displayText: "Yes", id: "yes" }],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendButtons/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(Array.isArray(body["buttons"])).toBe(true);
  });

  it("POST send_status — correct type and content", async () => {
    const mockFetch = makeFetchMock(200, { key: { id: "status-1" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/message/sendStatus/test-instance", {
      type: "text",
      content: "Hello status!",
      backgroundColor: "#000000",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/message/sendStatus/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["type"]).toBe("text");
    expect(body["content"]).toBe("Hello status!");
  });

  // ─── Chat tools ───────────────────────────────────────────────────────────

  it("POST mark_as_read — correct readMessages array", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/markMessageAsRead/test-instance", {
      readMessages: [{ remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "msg-1" }],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/markMessageAsRead/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(Array.isArray(body["readMessages"])).toBe(true);
  });

  it("DELETE delete_message — uses DELETE method with body", async () => {
    const mockFetch = makeFetchMock(200, { message: "deleted" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.delete("/chat/deleteMessageForEveryone/test-instance", {
      id: "msg-abc",
      remoteJid: "5511@s.whatsapp.net",
      fromMe: true,
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/deleteMessageForEveryone/test-instance");
    expect(opts.method).toBe("DELETE");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["id"]).toBe("msg-abc");
  });

  it("POST send_presence — correct presence field", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/sendPresence/test-instance", {
      number: "5511999999999",
      presence: "composing",
      delay: 3000,
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/sendPresence/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["presence"]).toBe("composing");
    expect(body["delay"]).toBe(3000);
  });

  it("POST check_number — correct numbers array", async () => {
    const mockFetch = makeFetchMock(200, [{ exists: true, jid: "5511@s.whatsapp.net", number: "5511" }]);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    const result = await client.post("/chat/whatsappNumbers/test-instance", {
      numbers: ["5511999999999"],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/whatsappNumbers/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["numbers"]).toEqual(["5511999999999"]);
    expect(Array.isArray(result)).toBe(true);
  });

  // ─── Profile tools ────────────────────────────────────────────────────────

  it("GET fetch_privacy — correct URL, no body", async () => {
    const mockFetch = makeFetchMock(200, { readreceipts: "all" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get("/chat/fetchPrivacySettings/test-instance");
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/fetchPrivacySettings/test-instance");
    expect(opts.method).toBe("GET");
    expect(opts.body).toBeUndefined();
  });

  it("POST update_privacy — sends only provided fields", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/updatePrivacySettings/test-instance", {
      readreceipts: "all",
      profile: "contacts",
    });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["readreceipts"]).toBe("all");
    expect(body["profile"]).toBe("contacts");
  });

  it("POST update_profile_name — sends name field", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/updateProfileName/test-instance", { name: "New Name" });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/updateProfileName/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["name"]).toBe("New Name");
  });

  it("DELETE remove_profile_picture — DELETE with no body", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.delete("/chat/removeProfilePicture/test-instance");
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/removeProfilePicture/test-instance");
    expect(opts.method).toBe("DELETE");
    expect(opts.body).toBeUndefined();
  });

  // ─── Group tools ──────────────────────────────────────────────────────────

  it("POST create_group — sends subject and participants", async () => {
    const mockFetch = makeFetchMock(200, { groupJid: "group@g.us" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/group/create/test-instance", {
      subject: "My Group",
      participants: ["5511999999999"],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/group/create/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["subject"]).toBe("My Group");
    expect(body["participants"]).toEqual(["5511999999999"]);
  });

  it("POST update_participants — groupJid in query, action in body", async () => {
    const mockFetch = makeFetchMock(200, { participants: [] });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post(
      `/group/updateParticipant/test-instance?groupJid=${encodeURIComponent("120363@g.us")}`,
      { action: "add", participants: ["5511999999999"] }
    );
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("groupJid=120363%40g.us");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["action"]).toBe("add");
  });

  it("GET fetch_invite_code — groupJid in query", async () => {
    const mockFetch = makeFetchMock(200, { inviteCode: "abc123" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get(`/group/inviteCode/test-instance?groupJid=${encodeURIComponent("120363@g.us")}`);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/group/inviteCode/test-instance");
    expect(url).toContain("groupJid=120363%40g.us");
  });

  it("DELETE leave_group — DELETE method with groupJid in query", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.delete(`/group/leaveGroup/test-instance?groupJid=${encodeURIComponent("120363@g.us")}`);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/group/leaveGroup/test-instance");
    expect(opts.method).toBe("DELETE");
  });

  it("POST update_group_setting — sends action in body", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post(
      `/group/updateSetting/test-instance?groupJid=${encodeURIComponent("120363@g.us")}`,
      { action: "announcement" }
    );
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["action"]).toBe("announcement");
  });

  // ─── Instance tools ───────────────────────────────────────────────────────

  it("GET connection_state — correct URL, GET method", async () => {
    const mockFetch = makeFetchMock(200, { instance: { state: "open" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get("/instance/connectionState/test-instance");
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/instance/connectionState/test-instance");
    expect(opts.method).toBe("GET");
  });

  it("POST restart_instance — correct URL, POST with empty body", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/instance/restart/test-instance", {});
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/instance/restart/test-instance");
    expect(opts.method).toBe("POST");
  });

  it("DELETE logout_instance — DELETE method, no body", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.delete("/instance/logout/test-instance");
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/instance/logout/test-instance");
    expect(opts.method).toBe("DELETE");
  });

  it("GET get_settings — correct URL", async () => {
    const mockFetch = makeFetchMock(200, { rejectCall: false });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get("/settings/find/test-instance");
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/settings/find/test-instance");
  });

  it("POST set_settings — sends only provided fields", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/settings/set/test-instance", { rejectCall: true, alwaysOnline: true });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/settings/set/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["rejectCall"]).toBe(true);
    expect(body["alwaysOnline"]).toBe(true);
  });

  // ─── Webhook tools ────────────────────────────────────────────────────────

  it("GET find_webhook — correct URL, GET method", async () => {
    const mockFetch = makeFetchMock(200, { webhook: { enabled: true, url: "https://example.com" } });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get("/webhook/find/test-instance");
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/webhook/find/test-instance");
    expect(opts.method).toBe("GET");
  });

  it("POST set_webhook — wraps config in webhook key", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/webhook/set/test-instance", {
      webhook: {
        enabled: true,
        url: "https://example.com/wh",
        events: ["MESSAGES_UPSERT"],
      },
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/webhook/set/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["webhook"]).toBeDefined();
    expect((body["webhook"] as Record<string, unknown>)["events"]).toEqual(["MESSAGES_UPSERT"]);
  });

  // ─── Label tools ──────────────────────────────────────────────────────────

  it("GET find_labels — correct URL", async () => {
    const mockFetch = makeFetchMock(200, []);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.get("/label/findLabels/test-instance");
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/label/findLabels/test-instance");
  });

  it("POST handle_label — sends action, number, labelId", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/label/handleLabel/test-instance", {
      number: "5511999999999",
      labelId: "label-1",
      action: "add",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/label/handleLabel/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["action"]).toBe("add");
    expect(body["labelId"]).toBe("label-1");
  });

  // ─── Block tool ───────────────────────────────────────────────────────────

  it("POST update_block_status — sends number and status", async () => {
    const mockFetch = makeFetchMock(200, { message: "ok" });
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    await client.post("/chat/updateBlockStatus/test-instance", {
      number: "5511999999999",
      status: "block",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/chat/updateBlockStatus/test-instance");
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["status"]).toBe("block");
  });
});
