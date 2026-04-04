import fs from "node:fs";
import path from "node:path";

export interface NamedTunnelRecord {
  pluginId: string;
  tunnelId: string;
  tunnelName: string;
  url: string;
}

export class NamedTunnelState {
  private filePath: string;
  private records: Map<string, NamedTunnelRecord>;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "cf-credentials", "tunnels.json");
    this.records = new Map();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as unknown;
        if (!Array.isArray(raw)) return;
        for (const r of raw) {
          if (
            typeof r === "object" &&
            r !== null &&
            typeof r.pluginId === "string" &&
            typeof r.tunnelId === "string" &&
            typeof r.tunnelName === "string" &&
            typeof r.url === "string"
          ) {
            this.records.set(r.pluginId, r as NamedTunnelRecord);
          } else {
            console.warn("[named-state] Skipping malformed record:", r);
          }
        }
      }
    } catch (err) {
      console.error("[named-state] Failed to load tunnel state:", err);
    }
  }

  private saveToDisk(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify([...this.records.values()], null, 2));
  }

  get(pluginId: string): NamedTunnelRecord | null {
    return this.records.get(pluginId) ?? null;
  }

  save(record: NamedTunnelRecord): void {
    this.records.set(record.pluginId, record);
    this.saveToDisk();
  }

  remove(pluginId: string): void {
    this.records.delete(pluginId);
    this.saveToDisk();
  }

  getAll(): NamedTunnelRecord[] {
    return [...this.records.values()];
  }
}
