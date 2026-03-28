import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { app, BrowserWindow } from "electron";

const MAX_RESTART_ATTEMPTS = 3;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5_000;

interface SidecarMessage {
  type: string;
  port?: number;
  error?: string;
}

export class SidecarManager {
  private process: ChildProcess | null = null;
  private port: number | null = null;
  private restartCount = 0;
  private intentionalStop = false;
  private starting = false;

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getPort(): number | null {
    return this.port;
  }

  async start(): Promise<void> {
    if (this.process || this.starting) return;
    this.starting = true;
    this.intentionalStop = false;

    const sidecarEntry = this.getSidecarEntryPath();

    try {
      this.process = spawn("bun", ["run", sidecarEntry], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          UNCORDED_SIDECAR: "1",
          UNCORDED_DATA_DIR: this.getDataDir(),
        },
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          this.handleStdoutLine(line);
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        console.error(`[sidecar] ${data.toString().trimEnd()}`);
      });

      this.process.on("exit", (code, signal) => {
        console.error(`[sidecar] Exited with code=${code} signal=${signal}`);
        this.process = null;
        this.port = null;
        this.starting = false;

        if (!this.intentionalStop) {
          this.handleCrash();
        }
      });

      this.process.on("error", (err) => {
        console.error(`[sidecar] Spawn error: ${err.message}`);
        this.process = null;
        this.starting = false;
        this.broadcastError(`Failed to start sidecar: ${err.message}`);
      });
    } catch (err) {
      this.starting = false;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sidecar] Failed to spawn: ${msg}`);
      this.broadcastError(`Failed to start sidecar: ${msg}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.intentionalStop = true;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.error("[sidecar] Graceful shutdown timed out, killing...");
          this.process.kill("SIGKILL");
        }
        resolve();
      }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

      this.process!.once("exit", () => {
        clearTimeout(timeout);
        this.process = null;
        this.port = null;
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      this.process!.kill("SIGTERM");
    });
  }

  private handleStdoutLine(line: string): void {
    // Try to parse as JSON message from sidecar
    try {
      const msg: SidecarMessage = JSON.parse(line);
      if (msg.type === "ready" && typeof msg.port === "number") {
        this.port = msg.port;
        this.restartCount = 0;
        this.starting = false;
        console.error(`[sidecar] Ready on port ${msg.port}`);
        this.broadcastReady(msg.port);
        return;
      }
      if (msg.type === "error") {
        console.error(`[sidecar] Error: ${msg.error}`);
        this.broadcastError(msg.error ?? "Unknown sidecar error");
        return;
      }
    } catch {
      // Not JSON — just regular log output
    }
    console.log(`[sidecar] ${line}`);
  }

  private handleCrash(): void {
    this.restartCount++;
    if (this.restartCount <= MAX_RESTART_ATTEMPTS) {
      console.error(`[sidecar] Restarting (attempt ${this.restartCount}/${MAX_RESTART_ATTEMPTS})...`);
      setTimeout(() => this.start(), 1_000 * this.restartCount);
    } else {
      console.error("[sidecar] Max restart attempts reached. Giving up.");
      this.broadcastError(
        `Sidecar crashed ${MAX_RESTART_ATTEMPTS} times. Please restart the app.`,
      );
    }
  }

  private broadcastReady(port: number): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("sidecar:ready", port);
      }
    }
  }

  private broadcastError(error: string): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("sidecar:error", error);
      }
    }
  }

  private getSidecarEntryPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "sidecar", "index.ts");
    }
    // Dev: run directly from source
    return path.join(__dirname, "..", "..", "sidecar", "index.ts");
  }

  private getDataDir(): string {
    return path.join(app.getPath("userData"), "sidecar-data");
  }
}
