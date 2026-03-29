import { BridgeHttpError } from "./errors.js";
import type { SetStorageOptions } from "./types.js";

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

/** KV storage wrapper around the bridge /storage endpoints. */
export class BridgeStorage {
  readonly #fetch: Fetcher;

  constructor(fetcher: Fetcher) {
    this.#fetch = fetcher;
  }

  /** Get a value by key. Returns `null` if not found. */
  async get<T = unknown>(key: string): Promise<T | null> {
    const res = await this.#fetch(`/bridge/storage/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new BridgeHttpError("GET", `/bridge/storage/${key}`, res.status, text);
    }
    const body = (await res.json()) as { key: string; value: T };
    return body.value;
  }

  /** Set a value. Optionally encrypt it at rest. */
  async set(key: string, value: unknown, options?: SetStorageOptions): Promise<void> {
    const params = options?.encrypt ? "?encrypt=true" : "";
    const res = await this.#fetch(`/bridge/storage/${encodeURIComponent(key)}${params}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BridgeHttpError("PUT", `/bridge/storage/${key}`, res.status, text);
    }
  }

  /** Delete a key. Returns whether it existed. */
  async delete(key: string): Promise<boolean> {
    const res = await this.#fetch(`/bridge/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      const text = await res.text();
      throw new BridgeHttpError("DELETE", `/bridge/storage/${key}`, res.status, text);
    }
    const body = (await res.json()) as { key: string; deleted: boolean };
    return body.deleted;
  }
}
