import { spawn, type ChildProcess } from "node:child_process";
import { ensureCloudflared } from "./binary";
import { CloudflareApi } from "./cloudflare-api";
import { CloudflareCredentialStore, type CloudflareCredentials } from "./credentials";
import { NamedTunnelState } from "./named-state";

interface TunnelInstance {
  pluginId: string;
  localPort: number;
  url: string;
  process: ChildProcess;
}

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const NAMED_CONN_REGEX = /Registered tunnel connection/;
const STARTUP_TIMEOUT_MS = 30_000;

export class TunnelManager {
  private tunnels = new Map<string, TunnelInstance>();
  private cloudflaredPath: string | null = null;
  private dataDir: string;
  private cfApi: CloudflareApi | null = null;
  private cfState: NamedTunnelState;
  private credStore: CloudflareCredentialStore;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.credStore = new CloudflareCredentialStore(dataDir);
    this.cfState = new NamedTunnelState(dataDir);

    // Load Cloudflare credentials if previously configured
    const creds = this.credStore.load();
    if (creds) {
      this.cfApi = new CloudflareApi(creds.apiToken, creds.accountId);
      console.error("[tunnel] Cloudflare named tunnel credentials loaded");
    }
  }

  // --- Cloudflare credential management ---

  isCloudflareConfigured(): boolean {
    return this.credStore.isConfigured() && this.cfApi !== null;
  }

  async validateAndSetCredentials(apiToken: string, accountId: string): Promise<boolean> {
    const api = new CloudflareApi(apiToken, accountId);

    // Verify read access
    const canRead = await api.validateCredentials();
    if (!canRead) return false;

    // Verify write access by creating and immediately deleting a test tunnel
    const testName = `uncorded-write-test-${Date.now()}`;
    let testTunnelId: string | null = null;
    try {
      const testTunnel = await api.createTunnel(testName);
      testTunnelId = testTunnel.id;
      await api.deleteTunnel(testTunnel.id);
    } catch (err) {
      // Best-effort cleanup if create succeeded but delete failed
      if (testTunnelId) {
        console.error(`[tunnel] Write test tunnel ${testName} leaked (delete failed):`, err);
      } else {
        console.error(
          "[tunnel] Cloudflare token lacks write permissions (Tunnel Edit scope required)",
        );
      }
      return false;
    }

    // Clear named tunnel records from a different account
    this.cfState.clearOtherAccounts(accountId);

    this.credStore.save({ apiToken, accountId });
    this.cfApi = api;
    console.error("[tunnel] Cloudflare credentials saved and validated (read + write)");
    return true;
  }

  setCloudflareCredentials(creds: CloudflareCredentials): void {
    this.cfState.clearOtherAccounts(creds.accountId);
    this.credStore.save(creds);
    this.cfApi = new CloudflareApi(creds.apiToken, creds.accountId);
  }

  clearCloudflareCredentials(): void {
    this.credStore.clear();
    this.cfApi = null;
    console.error("[tunnel] Cloudflare credentials cleared");
  }

  /**
   * Create a Cloudflare tunnel pointing at localhost:{port}.
   * Tries named tunnel first (if configured), falls back to quick tunnel.
   * Returns the public HTTPS URL.
   */
  async create(pluginId: string, localPort: number): Promise<string> {
    // Destroy any existing tunnel for this plugin
    await this.destroy(pluginId);

    if (!this.cloudflaredPath) {
      this.cloudflaredPath = await ensureCloudflared(this.dataDir);
    }

    // Try named tunnel first if Cloudflare credentials are configured
    if (this.cfApi) {
      try {
        return await this.createNamedTunnel(pluginId, localPort);
      } catch (err) {
        console.error(
          `[tunnel] Named tunnel failed for ${pluginId}, falling back to quick tunnel:`,
          err,
        );
      }
    }

    return this.createQuickTunnel(pluginId, localPort);
  }

  /**
   * Create a named tunnel via Cloudflare API with a stable URL.
   */
  private async createNamedTunnel(pluginId: string, localPort: number): Promise<string> {
    // Check if we already have a tunnel record for this plugin (reuse for stable URL)
    let record = this.cfState.get(pluginId);

    if (!record) {
      // Create a new tunnel via API
      const tunnelName = `uncorded-${pluginId}`;
      const tunnel = await this.cfApi!.createTunnel(tunnelName);
      const url = `https://${tunnel.id}.cfargotunnel.com`;
      record = { pluginId, tunnelId: tunnel.id, tunnelName, url, accountId: this.cfApi!.accountId };
      this.cfState.save(record);
      console.error(`[tunnel] Created named tunnel ${tunnelName} (${tunnel.id}) for ${pluginId}`);
    } else {
      console.error(`[tunnel] Reusing named tunnel ${record.tunnelName} for ${pluginId}`);
    }

    // Get a fresh run token — if the remote tunnel was deleted, recreate it
    let token: string;
    try {
      token = await this.cfApi!.getTunnelToken(record.tunnelId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("404")) {
        console.error(`[tunnel] Remote tunnel ${record.tunnelId} was deleted, recreating...`);
        this.cfState.remove(pluginId);
        const tunnelName = `uncorded-${pluginId}`;
        const tunnel = await this.cfApi!.createTunnel(tunnelName);
        const url = `https://${tunnel.id}.cfargotunnel.com`;
        record = {
          pluginId,
          tunnelId: tunnel.id,
          tunnelName,
          url,
          accountId: this.cfApi!.accountId,
        };
        this.cfState.save(record);
        token = await this.cfApi!.getTunnelToken(record.tunnelId);
      } else {
        throw err;
      }
    }

    // Spawn cloudflared with the run token
    const url = record.url;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.cloudflaredPath!,
        [
          "tunnel",
          "run",
          "--token",
          token,
          "--url",
          `http://localhost:${localPort}`,
          "--no-autoupdate",
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          reject(new Error(`Named tunnel startup timed out after ${STARTUP_TIMEOUT_MS}ms`));
        }
      }, STARTUP_TIMEOUT_MS);

      const handleData = (data: Buffer) => {
        const line = data.toString();
        if (resolved) return;

        if (NAMED_CONN_REGEX.test(line)) {
          resolved = true;
          clearTimeout(timeout);

          this.tunnels.set(pluginId, { pluginId, localPort, url, process: child });
          console.error(`[tunnel] Named tunnel connected for ${pluginId}: ${url}`);
          resolve();
        }
      };

      child.stderr?.on("data", handleData);
      child.stdout?.on("data", handleData);

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`cloudflared exited with code ${code} before named tunnel was ready`));
        }
        this.tunnels.delete(pluginId);
      });
    });

    return url;
  }

  /**
   * Create a quick tunnel (anonymous, ephemeral URL).
   */
  private createQuickTunnel(pluginId: string, localPort: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        this.cloudflaredPath!,
        ["tunnel", "--url", `http://localhost:${localPort}`, "--no-autoupdate"],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          reject(new Error(`Tunnel startup timed out after ${STARTUP_TIMEOUT_MS}ms`));
        }
      }, STARTUP_TIMEOUT_MS);

      const handleData = (data: Buffer) => {
        const line = data.toString();
        if (resolved) return;

        const match = TUNNEL_URL_REGEX.exec(line);
        if (match) {
          resolved = true;
          clearTimeout(timeout);

          const url = match[0];
          this.tunnels.set(pluginId, { pluginId, localPort, url, process: child });
          console.error(`[tunnel] Created tunnel for ${pluginId}: ${url}`);
          resolve(url);
        }
      };

      // cloudflared outputs the URL to stderr
      child.stderr?.on("data", handleData);
      child.stdout?.on("data", handleData);

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`cloudflared exited with code ${code} before tunnel was ready`));
        }
        this.tunnels.delete(pluginId);
      });
    });
  }

  private static readonly DESTROY_TIMEOUT_MS = 5_000;

  /**
   * Destroy the tunnel for a plugin, waiting for the process to exit.
   */
  async destroy(pluginId: string): Promise<void> {
    const tunnel = this.tunnels.get(pluginId);
    if (!tunnel) return;

    tunnel.process.kill();

    // Wait for the process to actually exit (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, TunnelManager.DESTROY_TIMEOUT_MS);

      tunnel.process.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      tunnel.process.on("error", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.tunnels.delete(pluginId);
    console.error(`[tunnel] Destroyed tunnel for ${pluginId}`);
  }

  /**
   * Delete a named tunnel from Cloudflare and remove local state.
   */
  async deleteNamedTunnel(pluginId: string): Promise<void> {
    const record = this.cfState.get(pluginId);
    if (!record) return;

    if (!this.cfApi) {
      console.error(
        `[tunnel] Cannot delete named tunnel ${record.tunnelName}: no Cloudflare API configured`,
      );
      return;
    }

    try {
      await this.cfApi.deleteTunnel(record.tunnelId);
      this.cfState.remove(pluginId);
      console.error(`[tunnel] Deleted named tunnel ${record.tunnelName} from Cloudflare`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("404")) {
        this.cfState.remove(pluginId);
        console.error(
          `[tunnel] Named tunnel ${record.tunnelName} already deleted remotely, cleaned local state`,
        );
      } else {
        console.error(
          `[tunnel] Failed to delete named tunnel ${record.tunnelName}, keeping record for retry:`,
          err,
        );
      }
    }
  }

  /**
   * Destroy all active tunnels (graceful shutdown).
   */
  async destroyAll(): Promise<void> {
    const ids = [...this.tunnels.keys()];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.destroy(id);
    }
  }

  /**
   * Get the current tunnel URL for a plugin, or null if no tunnel exists.
   */
  getUrl(pluginId: string): string | null {
    return this.tunnels.get(pluginId)?.url ?? null;
  }
}
