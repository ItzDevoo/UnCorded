import path from "node:path";
import fs from "node:fs";

interface SeedEntry {
  magnetURI: string;
  filePath: string;
  addedAt: string;
}

interface SeedIndex {
  seeds: SeedEntry[];
}

interface SeedStatus {
  magnetURI: string;
  filePath: string;
  peers: number;
  uploaded: number;
  uploadSpeed: number;
}

export class SeedingEngine {
  private seedDir: string;
  private indexPath: string;
  private client: unknown = null; // WebTorrent client — lazy loaded
  private seeds = new Map<string, { torrent: unknown; entry: SeedEntry }>();

  constructor(dataDir: string) {
    this.seedDir = path.join(dataDir, "seed-data");
    this.indexPath = path.join(this.seedDir, "index.json");
    fs.mkdirSync(this.seedDir, { recursive: true });
  }

  async resume(): Promise<void> {
    const index = this.loadIndex();
    if (index.seeds.length === 0) {
      console.error("[seeding] No seeds to resume");
      return;
    }

    await this.ensureClient();
    console.error(`[seeding] Resuming ${index.seeds.length} seeds...`);

    for (const entry of index.seeds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.seedFile(entry);
      } catch (err) {
        console.error(`[seeding] Failed to resume seed: ${entry.filePath}`, err);
      }
    }
  }

  async addSeed(filePath: string): Promise<string | null> {
    if (!fs.existsSync(filePath)) {
      console.error(`[seeding] File not found: ${filePath}`);
      return null;
    }

    await this.ensureClient();

    const entry: SeedEntry = {
      magnetURI: "", // Will be set after seeding
      filePath,
      addedAt: new Date().toISOString(),
    };

    const magnetURI = await this.seedFile(entry);
    if (magnetURI) {
      entry.magnetURI = magnetURI;
      this.saveIndex();
      return magnetURI;
    }

    return null;
  }

  removeSeed(magnetURI: string): boolean {
    const seed = this.seeds.get(magnetURI);
    if (!seed) return false;

    // Destroy the torrent
    if (this.client && typeof (this.client as Record<string, unknown>)["remove"] === "function") {
      try {
        (this.client as { remove: (id: string) => void }).remove(magnetURI);
      } catch {
        // Ignore
      }
    }

    this.seeds.delete(magnetURI);
    this.saveIndex();
    return true;
  }

  getStatus(): SeedStatus[] {
    const statuses: SeedStatus[] = [];
    for (const [magnetURI, { torrent, entry }] of this.seeds) {
      const t = torrent as Record<string, unknown>;
      statuses.push({
        magnetURI,
        filePath: entry.filePath,
        peers: typeof t["numPeers"] === "number" ? t["numPeers"] : 0,
        uploaded: typeof t["uploaded"] === "number" ? t["uploaded"] : 0,
        uploadSpeed: typeof t["uploadSpeed"] === "number" ? t["uploadSpeed"] : 0,
      });
    }
    return statuses;
  }

  async shutdown(): Promise<void> {
    this.saveIndex();

    if (this.client) {
      return new Promise<void>((resolve) => {
        const client = this.client as { destroy: (cb: () => void) => void };
        try {
          client.destroy(() => resolve());
        } catch {
          resolve();
        }
      });
    }
  }

  // --- Private ---

  private async ensureClient(): Promise<void> {
    if (this.client) return;

    try {
      // Dynamic import — webtorrent is heavy
      const WebTorrent = (await import("webtorrent")).default;
      this.client = new WebTorrent();
      console.error("[seeding] WebTorrent client initialized");
    } catch (err) {
      console.error("[seeding] Failed to initialize WebTorrent:", err);
    }
  }

  private async seedFile(entry: SeedEntry): Promise<string | null> {
    if (!this.client) return null;

    return new Promise<string | null>((resolve) => {
      const client = this.client as {
        seed: (
          input: string,
          opts: Record<string, unknown>,
          cb: (torrent: Record<string, unknown>) => void,
        ) => void;
      };

      try {
        client.seed(entry.filePath, {}, (torrent) => {
          const magnetURI = torrent["magnetURI"] as string;
          this.seeds.set(magnetURI, { torrent, entry: { ...entry, magnetURI } });
          console.error(
            `[seeding] Seeding: ${path.basename(entry.filePath)} (${magnetURI.slice(0, 60)}...)`,
          );
          resolve(magnetURI);
        });
      } catch (err) {
        console.error(`[seeding] Failed to seed: ${entry.filePath}`, err);
        resolve(null);
      }
    });
  }

  private loadIndex(): SeedIndex {
    try {
      if (fs.existsSync(this.indexPath)) {
        const raw = fs.readFileSync(this.indexPath, "utf-8");
        return JSON.parse(raw) as SeedIndex;
      }
    } catch {
      // Corrupted index — start fresh
    }
    return { seeds: [] };
  }

  private saveIndex(): void {
    const index: SeedIndex = {
      seeds: [...this.seeds.values()].map((s) => s.entry),
    };
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }
}
