import type { ChannelId } from "@uncorded/protocol";
import { BridgeError, PluginDestroyedError, RequestTimeoutError } from "./errors.js";
import type {
  Channel,
  Member,
  NavigateParams,
  PluginEvent,
  PluginOptions,
  PluginResponse,
  Server,
  ToastType,
  User,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

interface PendingRequest {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * PostMessage client for plugin UIs running inside iframes.
 * Communicates with the UnCorded shell via the postMessage bridge protocol.
 */
export class UnCordedPlugin {
  readonly #pending = new Map<string, PendingRequest>();
  readonly #listeners = new Map<string, Set<(data: unknown) => void>>();
  readonly #shellOrigin: string;
  readonly #timeoutMs: number;
  #idCounter = 0;

  constructor(options?: PluginOptions) {
    this.#timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Derive shell origin from document.referrer if not provided
    if (options?.shellOrigin) {
      this.#shellOrigin = options.shellOrigin;
    } else {
      try {
        this.#shellOrigin = new URL(document.referrer).origin;
      } catch {
        this.#shellOrigin = "*";
      }
    }

    window.addEventListener("message", this.#onMessage);
  }

  /** Remove the message listener. Call when the plugin is unmounting. */
  destroy(): void {
    window.removeEventListener("message", this.#onMessage);
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(new PluginDestroyedError());
    }
    this.#pending.clear();
    this.#listeners.clear();
  }

  // ── Request/Response ─────────────────────────────────────

  #nextId(): string {
    return `plugin-${++this.#idCounter}-${Date.now()}`;
  }

  #request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.#nextId();

      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new RequestTimeoutError(method, id, this.#timeoutMs));
      }, this.#timeoutMs);

      this.#pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      window.parent.postMessage(
        {
          type: "uncorded:request" as const,
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        },
        this.#shellOrigin,
      );
    });
  }

  readonly #onMessage = (event: MessageEvent): void => {
    // Validate message source is our parent window
    if (event.source !== window.parent) return;
    if (this.#shellOrigin !== "*" && event.origin !== this.#shellOrigin) return;

    const data: unknown = event.data;
    if (typeof data !== "object" || data === null) return;

    const msg = data as Record<string, unknown>;

    if (msg["type"] === "uncorded:response") {
      const response = msg as unknown as PluginResponse;
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(response.id);

      if (response.error) {
        pending.reject(new BridgeError(response.error.code, response.error.message));
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    if (msg["type"] === "uncorded:event") {
      const pluginEvent = msg as unknown as PluginEvent;
      const handlers = this.#listeners.get(pluginEvent.event);
      if (handlers) {
        for (const handler of handlers) {
          handler(pluginEvent.data);
        }
      }
    }
  };

  // ── Data Methods ─────────────────────────────────────────

  /** Get the current user. Returns `null` if user data is not yet available. */
  async getUser(): Promise<User | null> {
    return this.#request<User | null>("getUser");
  }

  /** Get the current server. Returns `null` if no server is selected. */
  async getServer(): Promise<Server | null> {
    return this.#request<Server | null>("getServer");
  }

  /** Get channels in the server. */
  async getChannels(): Promise<Channel[]> {
    return this.#request<Channel[]>("getChannels");
  }

  /** Get members of the server. */
  async getMembers(): Promise<Member[]> {
    return this.#request<Member[]>("getMembers");
  }

  /** Get presence data. */
  async getPresence(): Promise<unknown[]> {
    return this.#request<unknown[]>("getPresence");
  }

  // ── Actions ──────────────────────────────────────────────

  /** Send a message to a channel. */
  async sendMessage(channelId: ChannelId, content: string): Promise<{ sent: boolean }> {
    return this.#request<{ sent: boolean }>("sendMessage", { channelId, content });
  }

  /** Show a toast notification. */
  async showToast(message: string, type: ToastType = "info"): Promise<void> {
    await this.#request("showToast", { message, type });
  }

  /** Navigate within the app. */
  async navigate(to: NavigateParams["to"], channelId: ChannelId): Promise<void> {
    await this.#request("navigate", { to, channelId } satisfies NavigateParams);
  }

  // ── Events ───────────────────────────────────────────────

  /** Subscribe to a bridge event. */
  on<T = unknown>(event: string, handler: (data: T) => void): void {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(handler as (data: unknown) => void);
  }

  /** Unsubscribe from a bridge event. */
  off<T = unknown>(event: string, handler: (data: T) => void): void {
    const set = this.#listeners.get(event);
    if (set) {
      set.delete(handler as (data: unknown) => void);
      if (set.size === 0) this.#listeners.delete(event);
    }
  }
}
