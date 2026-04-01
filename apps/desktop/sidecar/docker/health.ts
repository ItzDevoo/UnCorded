import type { DockerManager } from "./manager";

const HEALTH_CHECK_INTERVAL_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_AUTO_RESTARTS = 3;

const READINESS_INITIAL_INTERVAL_MS = 500;
const READINESS_MAX_INTERVAL_MS = 4_000;
const READINESS_TIMEOUT_MS = 60_000;

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
type ReadyChangeHandler = (pluginId: string, ready: boolean) => void;

export class HealthMonitor {
  private states = new Map<string, HealthState>();
  private docker: DockerManager;
  private onStatusChange: StatusChangeHandler | null = null;
  private onReadyChange: ReadyChangeHandler | null = null;

  constructor(docker: DockerManager) {
    this.docker = docker;
  }

  setStatusChangeHandler(handler: StatusChangeHandler): void {
    this.onStatusChange = handler;
  }

  setReadyChangeHandler(handler: ReadyChangeHandler): void {
    this.onReadyChange = handler;
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

    this.states.set(pluginId, state);

    // Phase 1: readiness polling with exponential backoff, then phase 2: health checks
    this.pollReadiness(state, READINESS_INITIAL_INTERVAL_MS, Date.now());
  }

  private pollReadiness(state: HealthState, interval: number, startedAt: number): void {
    if (!this.states.has(state.pluginId)) return;

    state.timer = setTimeout(async () => {
      if (!this.states.has(state.pluginId)) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed >= READINESS_TIMEOUT_MS) {
        console.error(`[health] Plugin ${state.pluginId} readiness timed out after ${READINESS_TIMEOUT_MS}ms — marking ready anyway`);
        this.onReadyChange?.(state.pluginId, true);
        this.startHealthChecks(state);
        return;
      }

      try {
        const url = `http://127.0.0.1:${state.hostPort}/ready`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          if (response.ok) {
            // 200 — plugin is ready
            this.onReadyChange?.(state.pluginId, true);
            this.startHealthChecks(state);
            return;
          }

          if (response.status === 404) {
            // No /ready endpoint — backward compat, treat as ready
            console.error(
              `[health] Plugin ${state.pluginId} has no /ready endpoint — treating as ready. This fallback will be required in SDK v2.`,
            );
            this.onReadyChange?.(state.pluginId, true);
            this.startHealthChecks(state);
            return;
          }

          // 503 or other — keep polling
        } catch {
          clearTimeout(timeout);
          // Network error (container still booting) — keep polling
        }
      } catch {
        // Outer catch for unexpected errors — keep polling
      }

      const nextInterval = Math.min(interval * 2, READINESS_MAX_INTERVAL_MS);
      this.pollReadiness(state, nextInterval, startedAt);
    }, interval);
  }

  private startHealthChecks(state: HealthState): void {
    const scheduleNext = () => {
      if (!this.states.has(state.pluginId)) return;
      state.timer = setTimeout(async () => {
        await this.check(state);
        scheduleNext();
      }, HEALTH_CHECK_INTERVAL_MS);
    };

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
