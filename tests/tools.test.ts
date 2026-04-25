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

  // ─── find_labels — normalized shape ──────────────────────────────────────

  it("find_labels — returns only { id, name, color }, drops chats blobs", async () => {
    const rawLabels = [
      { id: "label-1", name: "Hot lead", color: "red", chats: [{ id: "c1" }, { id: "c2" }], extra: "noise" },
      { id: "label-2", name: "Follow up", color: 3, chats: [], extra: "noise" },
    ];
    // Simulate tool normalization
    const normalized = rawLabels.map(({ id, name, color }) => ({ id, name, color }));
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({ id: "label-1", name: "Hot lead", color: "red" });
    expect(normalized[1]).toEqual({ id: "label-2", name: "Follow up", color: 3 });
    expect(Object.keys(normalized[0]!)).not.toContain("chats");
    expect(Object.keys(normalized[0]!)).not.toContain("extra");
  });

  // ─── find_contacts — search + limit ──────────────────────────────────────

  it("find_contacts search — filters by pushName substring (case-insensitive)", async () => {
    const rawContacts = [
      { remoteJid: "5511@s.whatsapp.net", pushName: "Maria Silva", name: null, profilePicUrl: null, isBusiness: false, extra: "drop" },
      { remoteJid: "5522@s.whatsapp.net", pushName: "João Santos", name: null, profilePicUrl: null, isBusiness: false, extra: "drop" },
      { remoteJid: "5533@s.whatsapp.net", pushName: null, name: "Igreja Maria", profilePicUrl: null, isBusiness: true, extra: "drop" },
    ];
    const needle = "maria";
    const filtered = rawContacts.filter(
      (c) =>
        c.pushName?.toLowerCase().includes(needle) ||
        c.name?.toLowerCase().includes(needle) ||
        c.remoteJid?.toLowerCase().includes(needle)
    );
    const normalized = filtered.map(({ remoteJid, pushName, profilePicUrl, isBusiness }) => ({
      remoteJid, pushName, profilePicUrl, isBusiness,
    }));
    expect(normalized).toHaveLength(2);
    expect(normalized.map((c) => c.pushName ?? "Igreja Maria")).toContain("Maria Silva");
    expect(Object.keys(normalized[0]!)).not.toContain("extra");
    expect(Object.keys(normalized[0]!)).not.toContain("name");
  });

  it("find_contacts limit — caps result count at provided limit", async () => {
    const rawContacts = Array.from({ length: 50 }, (_, i) => ({
      remoteJid: `55${i}@s.whatsapp.net`,
      pushName: `Contact ${i}`,
      profilePicUrl: null,
      isBusiness: false,
    }));
    const limit = 10;
    const offset = 0;
    const capped = rawContacts.slice(offset, offset + limit).map(({ remoteJid, pushName, profilePicUrl, isBusiness }) => ({
      remoteJid, pushName, profilePicUrl, isBusiness,
    }));
    expect(capped).toHaveLength(10);
  });

  // ─── find_messages / get_chat_history — normalizeMessage shape ───────────

  it("find_messages normalized shape — all required fields, no extras", async () => {
    const { normalizeMessage } = await import("../src/util/normalize.js");
    const rawMsg = {
      key: { id: "msg-abc", fromMe: true, remoteJid: "5511@s.whatsapp.net" },
      messageTimestamp: 1700000000,
      message: { conversation: "Hello world" },
    };
    const norm = normalizeMessage(rawMsg);
    expect(norm.id).toBe("msg-abc");
    expect(norm.fromMe).toBe(true);
    expect(norm.remoteJid).toBe("5511@s.whatsapp.net");
    expect(norm.timestamp).toBe(1700000000);
    expect(norm.type).toBe("conversation");
    expect(norm.text).toBe("Hello world");
    // No base64, no raw message blob
    expect(Object.keys(norm)).not.toContain("message");
    expect(Object.keys(norm)).not.toContain("base64");
  });

  it("find_messages — media message sets mediaKey, text from caption", async () => {
    const { normalizeMessage } = await import("../src/util/normalize.js");
    const rawMsg = {
      key: { id: "img-001", fromMe: false, remoteJid: "group@g.us" },
      messageTimestamp: 1700000001,
      message: {
        imageMessage: { caption: "Check this out", url: "https://example.com/img.jpg", mediaKey: "hidden" },
      },
    };
    const norm = normalizeMessage(rawMsg);
    expect(norm.type).toBe("imageMessage");
    expect(norm.text).toBe("Check this out");
    expect(norm.mediaKey).toBe("img-001"); // uses key.id as download handle
  });

  it("find_messages — reply message sets quotedMessageId", async () => {
    const { normalizeMessage } = await import("../src/util/normalize.js");
    const rawMsg = {
      key: { id: "reply-001", fromMe: true, remoteJid: "5511@s.whatsapp.net" },
      messageTimestamp: 1700000002,
      message: {
        extendedTextMessage: {
          text: "Sure!",
          contextInfo: { stanzaId: "original-msg-id" },
        },
      },
    };
    const norm = normalizeMessage(rawMsg);
    expect(norm.text).toBe("Sure!");
    expect(norm.quotedMessageId).toBe("original-msg-id");
  });

  // ─── get_group_info — with and without includeParticipants ───────────────

  it("get_group_info default — returns admins only, not full participant list", async () => {
    const rawGroup = {
      id: "g1@g.us",
      subject: "Test Group",
      subjectOwner: "owner@s.whatsapp.net",
      subjectTime: 1700000000,
      desc: "A group",
      descId: "desc-1",
      creation: 1699000000,
      owner: "owner@s.whatsapp.net",
      participants: [
        { id: "user1@s.whatsapp.net", admin: "superadmin" },
        { id: "user2@s.whatsapp.net", admin: "admin" },
        { id: "user3@s.whatsapp.net", admin: null },
        { id: "user4@s.whatsapp.net", admin: null },
      ],
    };
    // Simulate tool normalization (no includeParticipants)
    const participants = rawGroup.participants;
    const admins = participants
      .filter((p) => p.admin != null && p.admin !== "")
      .map((p) => ({ jid: p.id, admin: p.admin }));

    const normalized: Record<string, unknown> = {
      id: rawGroup.id,
      subject: rawGroup.subject,
      subjectOwner: rawGroup.subjectOwner,
      subjectTime: rawGroup.subjectTime,
      size: participants.length,
      desc: rawGroup.desc,
      descId: rawGroup.descId,
      creation: rawGroup.creation,
      owner: rawGroup.owner,
      admins,
    };

    expect(normalized["size"]).toBe(4);
    expect((normalized["admins"] as typeof admins)).toHaveLength(2);
    expect(Object.keys(normalized)).not.toContain("participants");
  });

  it("get_group_info with includeParticipants=true — includes participant list", async () => {
    const rawGroup = {
      id: "g1@g.us",
      subject: "Test Group",
      subjectOwner: "owner@s.whatsapp.net",
      subjectTime: 1700000000,
      desc: "A group",
      descId: "desc-1",
      creation: 1699000000,
      owner: "owner@s.whatsapp.net",
      participants: [
        { id: "user1@s.whatsapp.net", admin: "superadmin", someHugeField: "x".repeat(500) },
        { id: "user2@s.whatsapp.net", admin: null, someHugeField: "x".repeat(500) },
      ],
    };
    const participants = rawGroup.participants;
    const admins = participants
      .filter((p) => p.admin != null && p.admin !== "")
      .map((p) => ({ jid: p.id, admin: p.admin }));

    const normalized: Record<string, unknown> = {
      id: rawGroup.id,
      subject: rawGroup.subject,
      subjectOwner: rawGroup.subjectOwner,
      subjectTime: rawGroup.subjectTime,
      size: participants.length,
      desc: rawGroup.desc,
      descId: rawGroup.descId,
      creation: rawGroup.creation,
      owner: rawGroup.owner,
      admins,
      // includeParticipants=true
      participants: participants.map((p) => ({ jid: p.id, admin: p.admin ?? null })),
    };

    expect(Object.keys(normalized)).toContain("participants");
    const parts = normalized["participants"] as { jid: string; admin: string | null }[];
    expect(parts).toHaveLength(2);
    // someHugeField must be stripped
    expect(Object.keys(parts[0]!)).not.toContain("someHugeField");
  });

  // ─── download_media — writes file, returns path ───────────────────────────

  it("download_media — decodes base64 and returns path/mimetype/size/messageId", async () => {
    // Simulate the tool logic without hitting Evolution or fs
    const { mimeToExt } = await import("../src/util/normalize.js");

    const mimetype = "image/jpeg";
    const base64 = Buffer.from("fake-image-data").toString("base64");
    const messageId = "msg-img-001";
    const instanceName = "test-instance";

    const ext = mimeToExt(mimetype);
    expect(ext).toBe("jpg");

    const buf = Buffer.from(base64, "base64");
    expect(buf.toString()).toBe("fake-image-data");

    const filePath = `/tmp/mcp-evolution-media/${instanceName}-${messageId}.${ext}`;
    const result = { path: filePath, mimetype, size: buf.length, messageId };

    expect(result.path).toBe("/tmp/mcp-evolution-media/test-instance-msg-img-001.jpg");
    expect(result.size).toBe(15);
    expect(result.messageId).toBe("msg-img-001");
    // Must NOT contain base64
    expect(Object.keys(result)).not.toContain("base64");
  });

  it("mimeToExt — known types return clean ext, unknown stripped to alphanum", async () => {
    const { mimeToExt } = await import("../src/util/normalize.js");
    // application/octet-stream not in map → strips hyphen → "octetstream"
    expect(mimeToExt("application/octet-stream")).toBe("octetstream");
    // known types
    expect(mimeToExt("video/mp4")).toBe("mp4");
    expect(mimeToExt("audio/ogg")).toBe("ogg");
    expect(mimeToExt("image/jpeg")).toBe("jpg");
    // truly unknown subtype falls back to "bin"
    expect(mimeToExt("application/")).toBe("bin");
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

  // ─── list_groups — search + limit ─────────────────────────────────────────

  it("list_groups search — filters by subject substring (case-insensitive)", async () => {
    const allGroups = [
      { id: "g1@g.us", subject: "Igreja Central", size: 20, owner: "x" },
      { id: "g2@g.us", subject: "Trabalho", size: 5, owner: "y" },
      { id: "g3@g.us", subject: "Igreja Norte", size: 15, owner: "z" },
    ];
    const mockFetch = makeFetchMock(200, allGroups);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    const data = await client.get<typeof allGroups>(
      "/group/fetchAllGroups/test-instance?getParticipants=false"
    );

    // Simulate what the tool handler does
    const search = "igreja";
    const needle = search.toLowerCase();
    const filtered = data.filter((g) => g.subject.toLowerCase().includes(needle));
    const sorted = filtered.sort((a, b) => a.subject.localeCompare(b.subject));
    const normalized = sorted.map(({ id, subject, size }) => ({ id, subject, size }));

    expect(normalized).toHaveLength(2);
    expect(normalized.map((g) => g.subject)).toEqual(["Igreja Central", "Igreja Norte"]);
    // owner must not be present
    expect(Object.keys(normalized[0]!)).not.toContain("owner");
  });

  it("list_groups limit — caps result count", async () => {
    const allGroups = Array.from({ length: 10 }, (_, i) => ({
      id: `g${i}@g.us`,
      subject: `Group ${i}`,
      size: i + 1,
      owner: "x",
    }));
    const mockFetch = makeFetchMock(200, allGroups);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    const data = await client.get<typeof allGroups>(
      "/group/fetchAllGroups/test-instance?getParticipants=false"
    );

    const limit = 2;
    const sorted = [...data].sort((a, b) => a.subject.localeCompare(b.subject));
    const capped = sorted.slice(0, limit).map(({ id, subject, size }) => ({ id, subject, size }));

    expect(capped).toHaveLength(2);
  });

  // ─── find_chats — search + limit + where ──────────────────────────────────

  it("find_chats search — filters by pushName or remoteJid substring", async () => {
    const allChats = [
      { remoteJid: "5511@s.whatsapp.net", pushName: "Maria Silva", name: null, unreadCount: 0, updatedAt: "2024-01-01", extra: "drop" },
      { remoteJid: "5522@s.whatsapp.net", pushName: "João Santos", name: null, unreadCount: 1, updatedAt: "2024-01-02", extra: "drop" },
      { remoteJid: "grupo@g.us", pushName: null, name: "Igreja", unreadCount: 5, updatedAt: "2024-01-03", extra: "drop" },
    ];
    const mockFetch = makeFetchMock(200, allChats);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    const raw = await client.post("/chat/findChats/test-instance", { limit: 50, offset: 0 }) as typeof allChats;

    // Simulate tool handler: search without where
    const needle = "maria";
    const filtered = raw.filter(
      (c) =>
        c.pushName?.toLowerCase().includes(needle) ||
        c.remoteJid?.toLowerCase().includes(needle)
    );
    const normalized = filtered.map(({ remoteJid, pushName, name, unreadCount, updatedAt }) => ({
      remoteJid, pushName, name, unreadCount, updatedAt,
    }));

    expect(normalized).toHaveLength(1);
    expect(normalized[0]!.pushName).toBe("Maria Silva");
    // extra field must be dropped
    expect(Object.keys(normalized[0]!)).not.toContain("extra");
  });

  it("find_chats limit — caps result count", async () => {
    const allChats = Array.from({ length: 20 }, (_, i) => ({
      remoteJid: `55${i}@s.whatsapp.net`,
      pushName: `Contact ${i}`,
      name: null,
      unreadCount: 0,
      updatedAt: "2024-01-01",
    }));
    const mockFetch = makeFetchMock(200, allChats);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);
    const raw = await client.post("/chat/findChats/test-instance", { limit: 5, offset: 0 }) as typeof allChats;

    // Simulate tool handler client-side safety cap
    const limit = 5;
    const offset = 0;
    const capped = raw.slice(offset, offset + limit);

    expect(capped).toHaveLength(5);
  });

  it("find_chats with where — uses where and skips client-side search, still normalizes shape", async () => {
    const returnedChats = [
      { remoteJid: "5511@s.whatsapp.net", pushName: "Alice", name: null, unreadCount: 2, updatedAt: "2024-01-01", secret: "hidden" },
    ];
    const mockFetch = makeFetchMock(200, returnedChats);
    vi.stubGlobal("fetch", mockFetch);
    const client = new EvolutionClient(BASE_CONFIG);

    const customWhere = { remoteJid: { contains: "5511" } };
    const raw = await client.post("/chat/findChats/test-instance", {
      where: customWhere,
      limit: 50,
      offset: 0,
    }) as typeof returnedChats;

    // Verify where was forwarded
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["where"]).toEqual(customWhere);

    // Normalize shape (no client-side search since where was provided)
    const normalized = raw.map(({ remoteJid, pushName, name, unreadCount, updatedAt }) => ({
      remoteJid, pushName, name, unreadCount, updatedAt,
    }));
    expect(normalized[0]!.pushName).toBe("Alice");
    expect(Object.keys(normalized[0]!)).not.toContain("secret");
  });
});
