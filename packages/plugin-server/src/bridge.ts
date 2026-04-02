import type { ChannelId, UserId } from "@uncorded/protocol";
import {
  BridgeConfigError,
  BridgeHttpError,
  BridgeNetworkError,
  BridgeNotFoundError,
} from "./errors.js";
import { BridgeStorage } from "./storage.js";
import type {
  BridgeOptions,
  Channel,
  GetMessagesOptions,
  Member,
  Message,
  Server,
  User,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Typed HTTP client for Docker plugins to talk to the UnCorded sidecar bridge. */
export class UnCordedBridge {
  readonly #baseUrl: string;
  readonly #token: string;
  readonly #timeoutMs: number;

  /** KV storage API. */
  readonly storage: BridgeStorage;

  /**
   * Tunnel URL — populated from UNCORDED_TUNNEL_URL env if set, otherwise
   * lazily fetched and cached on the first `getTunnelUrl()` call.
   * Prefer `getTunnelUrl()` for reliable access since the env var may not
   * be available at container boot (tunnel is allocated after startup).
   */
  #tunnelUrl: string | null = process.env["UNCORDED_TUNNEL_URL"] ?? null;

  get tunnelUrl(): string | null {
    return this.#tunnelUrl;
  }

  constructor(options?: BridgeOptions) {
    const baseUrl = options?.baseUrl ?? process.env["UNCORDED_BRIDGE_URL"];
    const token = options?.token ?? process.env["UNCORDED_BRIDGE_TOKEN"];

    if (!baseUrl) {
      throw new BridgeConfigError(
        "No base URL provided. Set UNCORDED_BRIDGE_URL or pass baseUrl option.",
      );
    }
    if (!token) {
      throw new BridgeConfigError(
        "No token provided. Set UNCORDED_BRIDGE_TOKEN or pass token option.",
      );
    }

    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#token = token;
    const rawTimeout = options?.timeoutMs;
    this.#timeoutMs =
      rawTimeout !== undefined && Number.isFinite(rawTimeout) && rawTimeout > 0
        ? rawTimeout
        : DEFAULT_TIMEOUT_MS;
    this.storage = new BridgeStorage((path, init) => this.#fetch(path, init));
  }

  // ── Helpers ──────────────────────────────────────────────

  async #fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.#baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          ...init?.headers,
        },
      });
      return res;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new BridgeNetworkError(`Request to ${path} timed out after ${this.#timeoutMs}ms`);
      }
      throw new BridgeNetworkError(`Network error on ${path}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  async #get<T>(path: string): Promise<T> {
    const res = await this.#fetch(path);
    if (!res.ok) {
      if (res.status === 404) throw new BridgeNotFoundError(path);
      const text = await res.text();
      throw new BridgeHttpError("GET", path, res.status, text);
    }
    return (await res.json()) as T;
  }

  async #post<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.#fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      if (res.status === 404) throw new BridgeNotFoundError(path);
      const text = await res.text();
      throw new BridgeHttpError("POST", path, res.status, text);
    }
    return (await res.json()) as T;
  }

  // ── Server ───────────────────────────────────────────────

  /** Get info about the server (or DM context) this plugin is installed in. */
  async getServer(): Promise<Server> {
    return this.#get<Server>("/bridge/server");
  }

  // ── Members ──────────────────────────────────────────────

  /** List members of the server (or friends in personal scope). */
  async getMembers(): Promise<Member[]> {
    const body = await this.#get<{ members: Member[] }>("/bridge/members");
    return body.members;
  }

  // ── Channels ─────────────────────────────────────────────

  /** List channels in the server. */
  async getChannels(): Promise<Channel[]> {
    const body = await this.#get<{ channels: Channel[] }>("/bridge/channels");
    return body.channels;
  }

  // ── Messages ─────────────────────────────────────────────

  /** Get messages from a channel. */
  async getMessages(channelId: ChannelId, options?: GetMessagesOptions): Promise<Message[]> {
    const params = options?.limit !== undefined ? `?limit=${options.limit}` : "";
    const body = await this.#get<{ channelId: string; messages: Message[]; limit: number }>(
      `/bridge/channels/${encodeURIComponent(channelId)}/messages${params}`,
    );
    return body.messages;
  }

  /** Send a message to a channel. */
  async sendMessage(
    channelId: ChannelId,
    content: string,
  ): Promise<{ sent: boolean; error?: string }> {
    return this.#post(`/bridge/channels/${encodeURIComponent(channelId)}/messages`, { content });
  }

  // ── Users ────────────────────────────────────────────────

  /** Get a user by ID. */
  async getUser(userId: UserId): Promise<User> {
    return this.#get<User>(`/bridge/users/${encodeURIComponent(userId)}`);
  }

  // ── Presence ─────────────────────────────────────────────

  /** Get presence data for server members. */
  async getPresence(): Promise<unknown[]> {
    const body = await this.#get<{ presence: unknown[] }>("/bridge/presence");
    return body.presence;
  }

  // ── Notifications ────────────────────────────────────────

  /** Send a notification. */
  async notify(options: {
    title: string;
    body: string;
  }): Promise<{ sent: boolean; error?: string }> {
    return this.#post("/bridge/notify", options);
  }

  // ── Config ───────────────────────────────────────────────

  /** Get the plugin's configuration. */
  async getConfig(): Promise<Record<string, unknown>> {
    const body = await this.#get<{ config: Record<string, unknown> }>("/bridge/config");
    return body.config;
  }

  /** Fetch this plugin's tunnel URL from the sidecar bridge and cache it. */
  async getTunnelUrl(): Promise<string | null> {
    if (this.#tunnelUrl) return this.#tunnelUrl;
    const body = await this.#get<{ tunnelUrl: string | null }>("/bridge/tunnel");
    this.#tunnelUrl = body.tunnelUrl;
    return this.#tunnelUrl;
  }
}
