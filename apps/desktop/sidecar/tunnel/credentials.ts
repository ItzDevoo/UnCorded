import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export interface CloudflareCredentials {
  apiToken: string;
  accountId: string;
}

export class CloudflareCredentialStore {
  private dir: string;
  private keyPath: string;
  private credPath: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, "cf-credentials");
    this.keyPath = path.join(this.dir, ".key");
    this.credPath = path.join(this.dir, "credentials.enc");
  }

  isConfigured(): boolean {
    return fs.existsSync(this.credPath) && fs.existsSync(this.keyPath);
  }

  save(creds: CloudflareCredentials): void {
    fs.mkdirSync(this.dir, { recursive: true });

    // Generate or read existing key
    let keyHex: string;
    if (fs.existsSync(this.keyPath)) {
      keyHex = fs.readFileSync(this.keyPath, "utf-8").trim();
    } else {
      keyHex = randomBytes(32).toString("hex");
      fs.writeFileSync(this.keyPath, keyHex, { mode: 0o600 });
    }

    const key = Buffer.from(keyHex, "hex");
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = JSON.stringify(creds);
    let encrypted = cipher.update(plaintext, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    fs.writeFileSync(
      this.credPath,
      JSON.stringify({ iv: iv.toString("hex"), tag, data: encrypted }),
    );
  }

  load(): CloudflareCredentials | null {
    if (!this.isConfigured()) return null;
    try {
      const keyHex = fs.readFileSync(this.keyPath, "utf-8").trim();
      const key = Buffer.from(keyHex, "hex");
      const stored = JSON.parse(fs.readFileSync(this.credPath, "utf-8")) as {
        iv: string;
        tag: string;
        data: string;
      };
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(stored.iv, "hex"));
      decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
      let decrypted = decipher.update(stored.data, "hex", "utf-8");
      decrypted += decipher.final("utf-8");
      return JSON.parse(decrypted) as CloudflareCredentials;
    } catch (err) {
      console.error("[cf-creds] Failed to load credentials:", err);
      return null;
    }
  }

  clear(): void {
    try {
      fs.unlinkSync(this.credPath);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(this.keyPath);
    } catch {
      /* ignore */
    }
  }
}
