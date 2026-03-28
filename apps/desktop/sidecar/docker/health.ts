import type { DockerManager } from "./manager";

const HEALTH_CHECK_INTERVAL_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_AUTO_RESTARTS = 3;

interface HealthState {
  containerId: string;
  pluginId: string;
  hostPort: number;
  healthCheckPath: string;
  consecutiveFailures: number;
  autoRestarts: number;
  isChecking: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

type StatusChangeHandler = (pluginId: string, status: "healthy" | "unhealthy" | "crashed") => void;

export class HealthMonitor {
  private states = new Map<string, HealthState>();
  private docker: DockerManager;
  private onStatusChange: StatusChangeHandler | null = null;

  constructor(docker: DockerManager) {
    this.docker = docker;
  }

  setStatusChangeHandler(handler: StatusChangeHandler): void {
    this.onStatusChange = handler;
  }

  startMonitoring(
    pluginId: string,
    containerId: string,
    hostPort: number,
    healthCheckPath = "/health",
  ): void {
    this.stopMonitoring(pluginId);

    const state: HealthState = {
      containerId,
      pluginId,
      hostPort,
      healthCheckPath,
      consecutiveFailures: 0,
      autoRestarts: 0,
      isChecking: false,
      timer: null,
    };

    // Use recursive setTimeout to prevent overlapping checks
    const scheduleNext = () => {
      if (!this.states.has(pluginId)) return;
      state.timer = setTimeout(async () => {
        await this.check(state);
        scheduleNext();
      }, HEALTH_CHECK_INTERVAL_MS);
    };

    this.states.set(pluginId, state);
    scheduleNext();
  }

  stopMonitoring(pluginId: string): void {
    const state = this.states.get(pluginId);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.states.delete(pluginId);
  }

  stopAll(): void {
    for (const pluginId of [...this.states.keys()]) {
      this.stopMonitoring(pluginId);
    }
  }

  private async check(state: HealthState): Promise<void> {
    // Guard against concurrent checks
    if (state.isChecking) return;
    if (!this.states.has(state.pluginId)) return;
    state.isChecking = true;

    try {
      const url = `http://127.0.0.1:${state.hostPort}${state.healthCheckPath}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
          if (state.consecutiveFailures > 0) {
            state.consecutiveFailures = 0;
            this.onStatusChange?.(state.pluginId, "healthy");
          }
          return;
        }
        state.consecutiveFailures++;
      } catch {
        clearTimeout(timeout);
        state.consecutiveFailures++;
      }

      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        if (state.autoRestarts < MAX_AUTO_RESTARTS) {
          console.error(`[health] Plugin ${state.pluginId} unhealthy (${state.consecutiveFailures} failures), restarting...`);
          state.autoRestarts++;
          state.consecutiveFailures = 0;
          this.onStatusChange?.(state.pluginId, "unhealthy");

          try {
            await this.docker.stopContainer(state.containerId);
            await this.docker.startContainer(state.containerId);

            const status = await this.docker.getStatus(state.containerId);
            if (status.hostPort) {
              state.hostPort = status.hostPort;
            }
          } catch (err) {
            console.error(`[health] Failed to restart plugin ${state.pluginId}:`, err);
            this.onStatusChange?.(state.pluginId, "crashed");
            this.stopMonitoring(state.pluginId);
          }
        } else {
          console.error(`[health] Plugin ${state.pluginId} exceeded max restarts, marking crashed`);
          this.onStatusChange?.(state.pluginId, "crashed");
          this.stopMonitoring(state.pluginId);
        }
      }
    } finally {
      state.isChecking = false;
    }
  }
}
