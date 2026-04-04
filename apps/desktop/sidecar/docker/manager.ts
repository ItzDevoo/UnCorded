import Dockerode from "dockerode";
import path from "node:path";
import { DOCKER_DEFAULT_CPUS, DOCKER_DEFAULT_MEMORY_MB } from "@uncorded/shared";
import { createDockerClient } from "./docker-host";

export interface ContainerConfig {
  image: string;
  pluginId: string;
  serverId: string;
  bridgeUrl: string;
  bridgeToken: string;
  tunnelUrl?: string | undefined;
  env?: Record<string, string> | undefined;
  resources?: ResourceLimits | undefined;
  healthCheckPath?: string | undefined;
  containerPort: number;
}

export interface ResourceLimits {
  cpus?: number | undefined;
  memoryMb?: number | undefined;
}

export interface ContainerStatus {
  id: string;
  pluginId: string;
  state: "running" | "stopped" | "crashed" | "created" | "unknown";
  hostPort: number | null;
  startedAt: string | null;
}

const DOCKER_NOT_RUNNING = "Docker is not running. Please start Docker Desktop and try again.";

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("enoent") ||
    msg.includes("epipe") ||
    msg.includes("typo in the url") ||
    msg.includes("connect econnreset")
  );
}

export class DockerManager {
  private docker: Dockerode;
  private dataDir: string;

  constructor(dataDir: string) {
    this.docker = createDockerClient();
    this.dataDir = dataDir;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async imageExists(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async pullImage(
    image: string,
    onProgress?: (event: { status: string; progress?: string }) => void,
    { skipIfExists = true }: { skipIfExists?: boolean } = {},
  ): Promise<void> {
    if (skipIfExists && (await this.imageExists(image))) {
      console.error(`[docker] Image ${image} already exists locally, skipping pull`);
      return;
    }

    let stream: NodeJS.ReadableStream;
    try {
      stream = await this.docker.pull(image);
    } catch (err) {
      if (isConnectionError(err)) throw new Error(DOCKER_NOT_RUNNING, { cause: err });
      throw err;
    }
    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
        (event: { status: string; progress?: string }) => {
          onProgress?.(event);
        },
      );
    });
  }

  /** Env var keys that plugins must never override — prevents clobbering system vars. */
  private static readonly ENV_DENYLIST: ReadonlySet<string> = new Set([
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "HOSTNAME",
    "LANG",
    "LC_ALL",
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "NODE_OPTIONS",
    "BUN_INSTALL",
  ]);

  async createContainer(config: ContainerConfig): Promise<string> {
    const pluginDataDir = path.join(this.dataDir, "plugin-data", config.pluginId);

    // Filter manifest env vars against denylist to prevent system var clobbering
    const safeEnv = Object.entries(config.env ?? {}).filter(([k]) => {
      if (DockerManager.ENV_DENYLIST.has(k)) {
        console.error(
          `[docker] Plugin ${config.pluginId}: blocked env var "${k}" (system denylist)`,
        );
        return false;
      }
      return true;
    });

    const envArray = [
      `UNCORDED_BRIDGE_URL=${config.bridgeUrl}`,
      `UNCORDED_BRIDGE_TOKEN=${config.bridgeToken}`,
      `UNCORDED_SERVER_ID=${config.serverId}`,
      `UNCORDED_PLUGIN_ID=${config.pluginId}`,
      ...(config.tunnelUrl ? [`UNCORDED_TUNNEL_URL=${config.tunnelUrl}`] : []),
      ...safeEnv.map(([k, v]) => `${k}=${v}`),
    ];

    const hostConfig: Dockerode.HostConfig = {
      PortBindings: {
        [`${config.containerPort}/tcp`]: [{ HostIp: "127.0.0.1", HostPort: "0" }],
      },
      Binds: [`${pluginDataDir}:/app/data`],
      RestartPolicy: { Name: "no" },
      // Resource limits
      NanoCpus: config.resources?.cpus ? config.resources.cpus * 1e9 : DOCKER_DEFAULT_CPUS * 1e9,
      Memory: config.resources?.memoryMb
        ? config.resources.memoryMb * 1024 * 1024
        : DOCKER_DEFAULT_MEMORY_MB * 1024 * 1024,
      // Allow container to reach host bridge server
      ExtraHosts: ["host.docker.internal:host-gateway"],
      // Security
      Privileged: false,
      ReadonlyRootfs: false,
      CapDrop: ["ALL"],
      CapAdd: ["NET_BIND_SERVICE"],
      SecurityOpt: ["no-new-privileges"],
    };

    let container: Dockerode.Container;
    try {
      container = await this.docker.createContainer({
        Image: config.image,
        Env: envArray,
        Labels: {
          "uncorded.plugin.id": config.pluginId,
          "uncorded.plugin.server": config.serverId,
          "uncorded.managed": "true",
        },
        ExposedPorts: {
          [`${config.containerPort}/tcp`]: {},
        },
        HostConfig: hostConfig,
      });
    } catch (err) {
      if (isConnectionError(err)) throw new Error(DOCKER_NOT_RUNNING, { cause: err });
      throw err;
    }

    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.start();
    } catch (err) {
      if (isConnectionError(err)) throw new Error(DOCKER_NOT_RUNNING, { cause: err });
      throw err;
    }
  }

  async stopContainer(containerId: string, timeoutSeconds = 10): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: timeoutSeconds });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return; // Container already removed
      if (status === 304) return; // Container already stopped
      // Try inspect — container might just be stopped already
      try {
        const info = await container.inspect();
        if (info.State.Running) await container.kill();
      } catch {
        // Container gone — nothing to stop
      }
    }
  }

  async removeContainer(containerId: string, force = false): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.remove({ force, v: true });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return; // Container already removed
      throw err;
    }
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();

    const labels = info.Config.Labels ?? {};
    const pluginId = labels["uncorded.plugin.id"] ?? "unknown";

    let state: ContainerStatus["state"] = "unknown";
    if (info.State.Running) state = "running";
    else if (info.State.ExitCode !== 0) state = "crashed";
    else if (info.State.Status === "created") state = "created";
    else state = "stopped";

    // Extract host port
    let hostPort: number | null = null;
    const portBindings = info.NetworkSettings.Ports;
    for (const bindings of Object.values(portBindings)) {
      if (bindings && bindings.length > 0) {
        const port = parseInt(bindings[0]!.HostPort ?? "0", 10);
        if (port > 0) {
          hostPort = port;
          break;
        }
      }
    }

    return {
      id: containerId,
      pluginId,
      state,
      hostPort,
      startedAt: info.State.StartedAt ?? null,
    };
  }

  async getLogs(containerId: string, tail = 100): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return logs.toString();
  }

  async listPluginContainers(): Promise<ContainerStatus[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: ["uncorded.managed=true"] },
    });

    const statuses: ContainerStatus[] = [];
    for (const c of containers) {
      const pluginId = c.Labels["uncorded.plugin.id"] ?? "unknown";

      let state: ContainerStatus["state"] = "unknown";
      if (c.State === "running") state = "running";
      else if (c.State === "exited") state = "stopped";
      else if (c.State === "created") state = "created";

      let hostPort: number | null = null;
      for (const p of c.Ports) {
        if (p.PublicPort && p.IP === "127.0.0.1") {
          hostPort = p.PublicPort;
          break;
        }
      }

      statuses.push({
        id: c.Id,
        pluginId,
        state,
        hostPort,
        startedAt: null,
      });
    }

    return statuses;
  }
}
