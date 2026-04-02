import { spawn, type ChildProcess } from "node:child_process";
import { ensureCloudflared } from "./binary";

interface TunnelInstance {
  pluginId: string;
  localPort: number;
  url: string;
  process: ChildProcess;
}

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const STARTUP_TIMEOUT_MS = 30_000;

export class TunnelManager {
  private tunnels = new Map<string, TunnelInstance>();
  private cloudflaredPath: string | null = null;
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Create a Cloudflare quick tunnel pointing at localhost:{port}.
   * Returns the public HTTPS URL (e.g. https://xxx.trycloudflare.com).
   */
  async create(pluginId: string, localPort: number): Promise<string> {
    // Destroy any existing tunnel for this plugin
    await this.destroy(pluginId);

    if (!this.cloudflaredPath) {
      this.cloudflaredPath = await ensureCloudflared(this.dataDir);
    }

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
