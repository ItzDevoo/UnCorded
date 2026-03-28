import Dockerode from "dockerode";
import path from "node:path";

export interface ContainerConfig {
  image: string;
  pluginId: string;
  serverId: string;
  bridgeUrl: string;
  bridgeToken: string;
  env?: Record<string, string> | undefined;
  resources?: ResourceLimits | undefined;
  healthCheckPath?: string | undefined;
  containerPort: number;
}

export interface ResourceLimits {
  cpus?: number | undefined;
  memoryMb?: number | undefined;
  storageMb?: number | undefined;
}

export interface ContainerStatus {
  id: string;
  pluginId: string;
  state: "running" | "stopped" | "crashed" | "created" | "unknown";
  hostPort: number | null;
  startedAt: string | null;
}

export class DockerManager {
  private docker: Dockerode;
  private dataDir: string;

  constructor(dataDir: string) {
    this.docker = new Dockerode();
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

  async pullImage(
    image: string,
    onProgress?: (event: { status: string; progress?: string }) => void,
  ): Promise<void> {
    const stream = await this.docker.pull(image);
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

  async createContainer(config: ContainerConfig): Promise<string> {
    const pluginDataDir = path.join(this.dataDir, "plugin-data", config.pluginId);

    const envArray = [
      `UNCORDED_BRIDGE_URL=${config.bridgeUrl}`,
      `UNCORDED_BRIDGE_TOKEN=${config.bridgeToken}`,
      `UNCORDED_SERVER_ID=${config.serverId}`,
      `UNCORDED_PLUGIN_ID=${config.pluginId}`,
      ...Object.entries(config.env ?? {}).map(([k, v]) => `${k}=${v}`),
    ];

    const hostConfig: Dockerode.HostConfig = {
      PortBindings: {
        [`${config.containerPort}/tcp`]: [{ HostIp: "127.0.0.1", HostPort: "0" }],
      },
      Binds: [`${pluginDataDir}:/app/data`],
      RestartPolicy: { Name: "no" },
      // Resource limits
      NanoCpus: config.resources?.cpus
        ? config.resources.cpus * 1e9
        : 1e9, // Default 1 CPU
      Memory: config.resources?.memoryMb
        ? config.resources.memoryMb * 1024 * 1024
        : 512 * 1024 * 1024, // Default 512MB
      // Security
      Privileged: false,
      ReadonlyRootfs: false,
      CapDrop: ["ALL"],
      CapAdd: ["NET_BIND_SERVICE"],
      SecurityOpt: ["no-new-privileges"],
    };

    const container = await this.docker.createContainer({
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

    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopContainer(containerId: string, timeoutSeconds = 10): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: timeoutSeconds });
    } catch (err) {
      // Container might already be stopped
      const info = await container.inspect();
      if (info.State.Running) {
        await container.kill();
      }
    }
  }

  async removeContainer(containerId: string, force = false): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force, v: true });
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
