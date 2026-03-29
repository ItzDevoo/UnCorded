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
    if (!res.ok) return null;
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
      throw new Error(`storage.set failed (${res.status}): ${text}`);
    }
  }

  /** Delete a key. Returns whether it existed. */
  async delete(key: string): Promise<boolean> {
    const res = await this.#fetch(`/bridge/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { key: string; deleted: boolean };
    return body.deleted;
  }
}
