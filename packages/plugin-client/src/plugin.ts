import type {
  Channel,
  EventHandler,
  Member,
  NavigateParams,
  PluginEvent,
  PluginResponse,
  Server,
  ToastType,
  User,
} from "./types.js";

/**
 * PostMessage client for plugin UIs running inside iframes.
 * Communicates with the UnCorded shell via the postMessage bridge protocol.
 */
export class UnCordedPlugin {
  readonly #pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  readonly #listeners = new Map<string, Set<EventHandler>>();
  #idCounter = 0;

  constructor() {
    window.addEventListener("message", this.#onMessage);
  }

  /** Remove the message listener. Call when the plugin is unmounting. */
  destroy(): void {
    window.removeEventListener("message", this.#onMessage);
    for (const [, { reject }] of this.#pending) {
      reject(new Error("Plugin destroyed"));
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
      this.#pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });

      window.parent.postMessage(
        {
          type: "uncorded:request" as const,
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        },
        "*",
      );
    });
  }

  readonly #onMessage = (event: MessageEvent): void => {
    const data: unknown = event.data;
    if (typeof data !== "object" || data === null) return;

    const msg = data as Record<string, unknown>;

    if (msg["type"] === "uncorded:response") {
      const response = msg as unknown as PluginResponse;
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      this.#pending.delete(response.id);

      if (response.error) {
        pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
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

  /** Get the current user. */
  async getUser(): Promise<User> {
    return this.#request<User>("getUser");
  }

  /** Get the current server. */
  async getServer(): Promise<Server> {
    return this.#request<Server>("getServer");
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
  async sendMessage(channelId: string, content: string): Promise<{ sent: boolean }> {
    return this.#request<{ sent: boolean }>("sendMessage", { channelId, content });
  }

  /** Show a toast notification. */
  showToast(message: string, type: ToastType = "info"): void {
    void this.#request("showToast", { message, type });
  }

  /** Navigate within the app. */
  navigate(to: NavigateParams["to"], channelId: string): void {
    void this.#request("navigate", { to, channelId } satisfies NavigateParams);
  }

  // ── Events ───────────────────────────────────────────────

  /** Subscribe to a bridge event. */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(handler as EventHandler);
  }

  /** Unsubscribe from a bridge event. */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const set = this.#listeners.get(event);
    if (set) {
      set.delete(handler as EventHandler);
      if (set.size === 0) this.#listeners.delete(event);
    }
  }
}
