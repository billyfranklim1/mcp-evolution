import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";

export class EvolutionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor(config: Config) {
    // Strip trailing slash to keep URL building consistent
    this.baseUrl = config.EVOLUTION_API_URL.replace(/\/$/, "");
    this.apiKey = config.EVOLUTION_API_KEY;
    this.instance = config.EVOLUTION_INSTANCE;
  }

  get instanceName(): string {
    return this.instance;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      apikey: this.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `Evolution API error ${res.status}: ${text}`
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}
