import fs from "node:fs";
import path from "node:path";
import type { DockerManager } from "../docker/manager";
import { NetworkManager } from "../docker/networks";
import { HealthMonitor } from "../docker/health";
import { ResourceEnforcer } from "../docker/resources";
import { issueToken, revokePluginTokens } from "./tokens";
import { parseManifest, type PluginManifest } from "./manifest";

export type PluginState = "installed" | "starting" | "running" | "stopping" | "stopped" | "crashed" | "error";

interface PluginRecord {
  pluginId: string;
  serverId: string;
  manifest: PluginManifest;
  containerId: string | null;
  state: PluginState;
  hostPort: number | null;
  bridgeToken: string | null;
  previouslyRunning: boolean;
  installedAt: string;
  error?: string | undefined;
}

interface StateFile {
  plugins: Record<string, PluginRecord>;
}

export class PluginLifecycle {
  private docker: DockerManager;
  private networks: NetworkManager;
  private health: HealthMonitor;
  private resources: ResourceEnforcer;
  private dataDir: string;
  private statePath: string;
  private plugins = new Map<string, PluginRecord>();
  private bridgePort = 0;

  constructor(docker: DockerManager, dataDir: string) {
    this.docker = docker;
    this.networks = new NetworkManager();
    this.health = new HealthMonitor(docker);
    this.resources = new ResourceEnforcer();
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, "plugin-data", ".state.json");

    this.health.setStatusChangeHandler((pluginId, status) => {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) return;

      if (status === "crashed") {
        plugin.state = "crashed";
        plugin.previouslyRunning = false;
        revokePluginTokens(pluginId);
        this.resources.release(plugin.manifest.resources ?? {});
        this.saveState();
      }
    });

    this.loadState();
  }

  // --- Public API ---

  async install(manifestRaw: unknown, serverId: string): Promise<{ pluginId: string; errors?: string[] }> {
    const { manifest, errors } = parseManifest(manifestRaw);
    if (errors.length > 0) {
      return { pluginId: "", errors };
    }

    // Check resources
    const resourceCheck = this.resources.validateAndReserve(manifest.resources ?? {});
    if (!resourceCheck.allowed) {
      return { pluginId: manifest.id, errors: [resourceCheck.reason!] };
    }

    try {
      // Create data directory
      const pluginDataDir = path.join(this.dataDir, "plugin-data", manifest.id);
      fs.mkdirSync(pluginDataDir, { recursive: true });

      // Pull image
      console.error(`[lifecycle] Pulling image: ${manifest.runtime.image}`);
      await this.docker.pullImage(manifest.runtime.image, (event) => {
        console.error(`[lifecycle] Pull: ${event.status} ${event.progress ?? ""}`);
      });

      // Create network
      await this.networks.createPluginNetwork(manifest.id);

      // Issue bridge token
      const bridgeToken = issueToken(manifest.id, serverId, manifest.permissions);

      // Create container
      const containerId = await this.docker.createContainer({
        image: manifest.runtime.image,
        pluginId: manifest.id,
        serverId,
        bridgeUrl: `http://host.docker.internal:${this.getBridgePort()}`,
        bridgeToken,
        resources: manifest.resources,
        healthCheckPath: manifest.runtime.healthCheck,
        containerPort: manifest.runtime.port,
      });

      // Connect to plugin network
      await this.networks.connectContainer(manifest.id, containerId);

      const record: PluginRecord = {
        pluginId: manifest.id,
        serverId,
        manifest,
        containerId,
        state: "installed",
        hostPort: null,
        bridgeToken,
        previouslyRunning: false,
        installedAt: new Date().toISOString(),
      };

      this.plugins.set(manifest.id, record);
      this.saveState();

      console.error(`[lifecycle] Installed plugin: ${manifest.name} (${manifest.id})`);
      return { pluginId: manifest.id };
    } catch (err) {
      // Release reserved resources on any failure
      this.resources.release(manifest.resources ?? {});
      throw err;
    }
  }

  async start(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.containerId) {
      throw new Error(`Plugin ${pluginId} not found or not installed`);
    }

    plugin.state = "starting";
    this.saveState();

    // Token is baked into the container env at create time — register it in
    // the auth store so the bridge can validate it (needed after sidecar restart)
    if (plugin.bridgeToken) {
      issueToken(pluginId, plugin.serverId, plugin.manifest.permissions);
    }

    // Start container
    await this.docker.startContainer(plugin.containerId);

    // Get assigned port
    const status = await this.docker.getStatus(plugin.containerId);
    plugin.hostPort = status.hostPort;
    plugin.state = "running";
    plugin.previouslyRunning = true;
    this.saveState();

    // Start health monitoring
    if (plugin.hostPort) {
      this.health.startMonitoring(
        pluginId,
        plugin.containerId,
        plugin.hostPort,
        plugin.manifest.runtime.healthCheck,
      );
    }

    console.error(`[lifecycle] Started plugin: ${pluginId} on port ${plugin.hostPort}`);
  }

  async stop(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.containerId) return;

    plugin.state = "stopping";
    this.saveState();

    // Stop health monitoring FIRST to prevent restart races
    this.health.stopMonitoring(pluginId);
    revokePluginTokens(pluginId);

    await this.docker.stopContainer(plugin.containerId);

    plugin.state = "stopped";
    plugin.previouslyRunning = false;
    plugin.hostPort = null;
    this.saveState();

    console.error(`[lifecycle] Stopped plugin: ${pluginId}`);
  }

  async restart(pluginId: string): Promise<void> {
    await this.stop(pluginId);
    await this.start(pluginId);
  }

  async uninstall(pluginId: string, keepData = false): Promise<void> {
    await this.stop(pluginId);

    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Remove container
    if (plugin.containerId) {
      await this.docker.removeContainer(plugin.containerId, true);
    }

    // Remove network
    await this.networks.removePluginNetwork(pluginId);

    // Release resources
    this.resources.release(plugin.manifest.resources ?? {});

    // Remove data if requested
    if (!keepData) {
      const pluginDataDir = path.join(this.dataDir, "plugin-data", pluginId);
      if (fs.existsSync(pluginDataDir)) {
        fs.rmSync(pluginDataDir, { recursive: true, force: true });
      }
    }

    this.plugins.delete(pluginId);
    this.saveState();

    console.error(`[lifecycle] Uninstalled plugin: ${pluginId} (keepData=${keepData})`);
  }

  async update(pluginId: string, newManifestRaw: unknown): Promise<{ errors?: string[] }> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return { errors: ["Plugin not found"] };

    const { manifest: newManifest, errors } = parseManifest(newManifestRaw);
    if (errors.length > 0) return { errors };

    const wasRunning = plugin.state === "running";
    if (wasRunning) {
      await this.stop(pluginId);
    }

    // Pull new image — force re-pull to pick up mutable tag changes (e.g. :latest)
    await this.docker.pullImage(newManifest.runtime.image, undefined, { skipIfExists: false });

    // Create new container FIRST, then remove old one (rollback-safe)
    const bridgeToken = issueToken(pluginId, plugin.serverId, newManifest.permissions);
    const newContainerId = await this.docker.createContainer({
      image: newManifest.runtime.image,
      pluginId,
      serverId: plugin.serverId,
      bridgeUrl: `http://host.docker.internal:${this.getBridgePort()}`,
      bridgeToken,
      resources: newManifest.resources,
      healthCheckPath: newManifest.runtime.healthCheck,
      containerPort: newManifest.runtime.port,
    });

    await this.networks.connectContainer(pluginId, newContainerId);

    // New container ready — now remove the old one
    const oldContainerId = plugin.containerId;
    if (oldContainerId) {
      await this.docker.removeContainer(oldContainerId, true);
    }

    plugin.manifest = newManifest;
    plugin.containerId = newContainerId;
    plugin.bridgeToken = bridgeToken;
    this.saveState();

    if (wasRunning) {
      await this.start(pluginId);
    }

    console.error(`[lifecycle] Updated plugin: ${pluginId} to v${newManifest.version}`);
    return {};
  }

  async resumeAll(): Promise<void> {
    const toResume = [...this.plugins.values()].filter((p) => p.previouslyRunning);
    if (toResume.length === 0) return;

    console.error(`[lifecycle] Resuming ${toResume.length} previously running plugins...`);

    for (const plugin of toResume) {
      try {
        await this.start(plugin.pluginId);
      } catch (err) {
        console.error(`[lifecycle] Failed to resume ${plugin.pluginId}:`, err);
        plugin.state = "error";
        plugin.error = err instanceof Error ? err.message : "Failed to resume";
        this.saveState();
      }
    }
  }

  async stopAll(): Promise<void> {
    this.health.stopAll();

    for (const plugin of this.plugins.values()) {
      if (plugin.state === "running" && plugin.containerId) {
        try {
          await this.docker.stopContainer(plugin.containerId);
        } catch (err) {
          console.error(`[lifecycle] Error stopping ${plugin.pluginId}:`, err);
        }
      }
    }
  }

  setBridgePort(port: number): void {
    this.bridgePort = port;
  }

  // --- Queries ---

  list(): PluginRecord[] {
    return [...this.plugins.values()];
  }

  get(pluginId: string): PluginRecord | undefined {
    return this.plugins.get(pluginId);
  }

  // --- State persistence ---

  private loadState(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const raw = fs.readFileSync(this.statePath, "utf-8");
        const state = JSON.parse(raw) as StateFile;
        for (const [id, record] of Object.entries(state.plugins)) {
          this.plugins.set(id, record);
        }
        console.error(`[lifecycle] Loaded ${this.plugins.size} plugins from state`);
      }
    } catch (err) {
      console.error("[lifecycle] Failed to load state:", err);
    }
  }

  private saveState(): void {
    const state: StateFile = {
      plugins: Object.fromEntries(this.plugins),
    };

    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  private getBridgePort(): number {
    return this.bridgePort;
  }
}
