import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { GuardError } from "./errors.js";
import { createRedactor, type Redactor } from "./util/redact.js";

export interface EvolutionClientOptions {
  apiUrl: string;
  apiKey: string;
  basicAuth?: string;
  /** Instances this client may address. Omit to allow any (tests only). */
  instances?: readonly string[];
  /** Extra secrets to mask in error messages (e.g. DB URL). */
  dbUrl?: string;
}

/**
 * Stateless HTTP client for Evolution API. It holds only immutable connection settings;
 * the target instance is chosen per call via forInstance(), checked against the allowlist.
 */
export class EvolutionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly basicAuth?: string;
  private readonly instances?: ReadonlySet<string>;
  readonly redact: Redactor;

  constructor(opts: EvolutionClientOptions) {
    // Strip trailing slash to keep URL building consistent
    this.baseUrl = opts.apiUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.basicAuth = opts.basicAuth;
    this.instances = opts.instances ? new Set(opts.instances) : undefined;
    this.redact = createRedactor({
      apiKey: opts.apiKey,
      basicAuth: opts.basicAuth,
      apiUrl: opts.apiUrl,
      dbUrl: opts.dbUrl,
    });
  }

  /** Immutable view bound to one allowlisted instance. */
  forInstance(instance: string): InstanceClient {
    if (this.instances && !this.instances.has(instance)) {
      throw new GuardError(`Instance "${instance}" is not configured. Use list_instances to see the allowed ones.`);
    }
    return new InstanceClient(this, instance);
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      apikey: this.apiKey,
      "Content-Type": "application/json",
    };

    if (this.basicAuth) headers.Authorization = `Basic ${this.basicAuth}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, this.redact(`Evolution API request failed: ${msg}`));
    }

    const text = await res.text();

    if (!res.ok) {
      throw new McpError(ErrorCode.InternalError, this.redact(`Evolution API error ${res.status}: ${text}`));
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}

/** Per-call, per-instance client handed to tool handlers. */
export class InstanceClient {
  constructor(
    private readonly http: EvolutionClient,
    readonly instanceName: string
  ) {}

  get<T = unknown>(path: string): Promise<T> {
    return this.http.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.http.request<T>("POST", path, body);
  }

  delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.http.request<T>("DELETE", path, body);
  }
}
