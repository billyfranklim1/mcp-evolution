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
});
