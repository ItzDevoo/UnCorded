import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MAX_VALUE_SIZE = 1024 * 1024; // 1 MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB per plugin

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

export class PluginStorage {
  private baseDir: string;

  constructor(dataDir: string) {
    this.baseDir = path.join(dataDir, "plugin-data");
  }

  private getKvDir(pluginId: string): string {
    const dir = path.join(this.baseDir, pluginId, ".bridge-kv");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private getKeyPath(pluginId: string, key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    return path.join(this.getKvDir(pluginId), `${safeKey}.json`);
  }

  /**
   * Get or create a persistent per-plugin data encryption key.
   * Stored on disk so encrypted values survive token rotations.
   */
  private getPluginDataKey(pluginId: string): string {
    const keyPath = path.join(this.baseDir, pluginId, ".bridge-kv", ".data-key");
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, "utf-8").trim();
      }
    } catch {
      // Corrupted key file — regenerate
    }
    const key = randomBytes(32).toString("hex");
    const dir = path.dirname(keyPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }

  get(pluginId: string, key: string): unknown | null {
    const filePath = this.getKeyPath(pluginId, key);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const stored = JSON.parse(raw) as { encrypted: boolean; value: unknown; iv?: string; tag?: string };

    if (stored.encrypted) {
      const dataKey = this.getPluginDataKey(pluginId);
      return this.decrypt(stored.value as string, stored.iv!, stored.tag!, dataKey);
    }

    return stored.value;
  }

  set(pluginId: string, key: string, value: unknown, encrypt?: boolean): { success: boolean; error?: string | undefined } {
    const serialized = JSON.stringify(value);
    const valueBytes = Buffer.byteLength(serialized, "utf-8");

    if (valueBytes > MAX_VALUE_SIZE) {
      return { success: false, error: `Value exceeds max size of ${MAX_VALUE_SIZE / 1024}KB` };
    }

    const filePath = this.getKeyPath(pluginId, key);

    // Account for existing file size when checking total quota (overwrite = delta)
    let existingSize = 0;
    try {
      existingSize = fs.statSync(filePath).size;
    } catch {
      // File doesn't exist yet
    }

    const totalSize = this.getTotalSize(pluginId);
    // Encrypted values expand due to hex encoding (~2x) + JSON wrapper overhead
    const estimatedNewSize = encrypt ? valueBytes * 2 + 200 : valueBytes + 50;
    if (totalSize - existingSize + estimatedNewSize > MAX_TOTAL_SIZE) {
      return { success: false, error: `Total storage would exceed ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit` };
    }

    if (encrypt) {
      const dataKey = this.getPluginDataKey(pluginId);
      const { encrypted, iv, tag } = this.encrypt(serialized, dataKey);
      fs.writeFileSync(filePath, JSON.stringify({ encrypted: true, value: encrypted, iv, tag }));
    } else {
      fs.writeFileSync(filePath, JSON.stringify({ encrypted: false, value }));
    }

    return { success: true };
  }

  delete(pluginId: string, key: string): boolean {
    const filePath = this.getKeyPath(pluginId, key);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  private getTotalSize(pluginId: string): number {
    const dir = this.getKvDir(pluginId);
    let total = 0;
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file === ".data-key") continue; // Don't count the key file
        const stat = fs.statSync(path.join(dir, file));
        total += stat.size;
      }
    } catch {
      // Dir might not exist yet
    }
    return total;
  }

  private encrypt(data: string, key: string): { encrypted: string; iv: string; tag: string } {
    const derivedKey = scryptSync(key, "uncorded-bridge-salt", 32);
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(data, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return { encrypted, iv: iv.toString("hex"), tag };
  }

  private decrypt(data: string, ivHex: string, tagHex: string, key: string): unknown {
    const derivedKey = scryptSync(key, "uncorded-bridge-salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(data, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return JSON.parse(decrypted);
  }
}
