import type { ChannelId } from "@uncorded/protocol";
import { PluginError } from "@uncorded/shared";
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
  readonly #errorHandlers = new Set<(error: Error) => void>();

  constructor(options?: PluginOptions) {
    this.#timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Derive shell origin: explicit option > document.referrer > URL query param
    if (options?.shellOrigin) {
      this.#shellOrigin = options.shellOrigin;
    } else {
      let origin: string | null = null;
      // Try document.referrer first (works in browsers with referrerpolicy="origin")
      try {
        if (document.referrer) origin = new URL(document.referrer).origin;
      } catch {
        /* invalid referrer — fall through */
      }
      // Fallback: shell injects ?shellOrigin= on the iframe src
      if (!origin) {
        try {
          origin = new URLSearchParams(window.location.search).get("shellOrigin");
        } catch {
          /* no search params — fall through */
        }
      }
      if (!origin) {
        throw new Error("Unable to determine shell origin. Pass shellOrigin in PluginOptions.");
      }
      this.#shellOrigin = origin;
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
        const err = PluginError.isPayload(response.error)
          ? PluginError.fromPayload(response.error)
          : new BridgeError(response.error.code, response.error.message);
        pending.reject(err);
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
          try {
            handler(pluginEvent.data);
          } catch (err) {
            console.error(`[uncorded] Event handler for "${pluginEvent.event}" threw:`, err);
            const wrapped = err instanceof Error ? err : new Error(String(err));
            for (const eh of this.#errorHandlers) eh(wrapped);
          }
        }
      }
    }
  };

  /** Whether this iframe is running in the sidebar context (/sidebar route). */
  get isSidebar(): boolean {
    try {
      return new URL(window.location.href).pathname.endsWith("/sidebar");
    } catch {
      return false;
    }
  }

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

  /** Register a global error handler. Returns a cleanup function. */
  onError(handler: (error: Error) => void): () => void {
    this.#errorHandlers.add(handler);
    return () => {
      this.#errorHandlers.delete(handler);
    };
  }
}
