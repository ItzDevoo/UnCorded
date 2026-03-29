import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STORAGE_DIR = ".mock-data";

/** File-based KV store for the mock bridge. */
export class MockStorage {
  readonly #dir: string;

  constructor(baseDir: string = process.cwd()) {
    this.#dir = join(baseDir, STORAGE_DIR);
    if (!existsSync(this.#dir)) {
      mkdirSync(this.#dir, { recursive: true });
    }
  }

  #keyPath(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.#dir, `${safe}.json`);
  }

  get(key: string): unknown {
    const path = this.#keyPath(key);
    if (!existsSync(path)) return null;
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw) as { value: unknown };
      return parsed.value;
    } catch {
      console.error(`[mock-bridge] Corrupted storage file: ${path}`);
      return null;
    }
  }

  set(key: string, value: unknown, encrypt?: boolean): void {
    const path = this.#keyPath(key);
    writeFileSync(path, JSON.stringify({ encrypted: Boolean(encrypt), value }), "utf-8");
  }

  delete(key: string): boolean {
    const path = this.#keyPath(key);
    if (!existsSync(path)) return false;
    rmSync(path);
    return true;
  }
}
