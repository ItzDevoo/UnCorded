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

  /** Check whether `state` is still the active session for its pluginId. */
  private isActive(state: HealthState): boolean {
    return this.states.get(state.pluginId) === state;
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
    if (!this.isActive(state)) return;

    state.timer = setTimeout(async () => {
      if (!this.isActive(state)) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed >= READINESS_TIMEOUT_MS) {
        console.error(
          `[health] Plugin ${state.pluginId} readiness timed out after ${READINESS_TIMEOUT_MS}ms — marking unhealthy`,
        );
        if (!this.isActive(state)) return;
        this.onReadyChange?.(state.pluginId, false);
        this.onStatusChange?.(state.pluginId, "unhealthy");
        this.stopMonitoring(state.pluginId);
        return;
      }

      try {
        const url = `http://127.0.0.1:${state.hostPort}/ready`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          // Verify session still active after await
          if (!this.isActive(state)) return;

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

      if (!this.isActive(state)) return;
      const nextInterval = Math.min(interval * 2, READINESS_MAX_INTERVAL_MS);
      this.pollReadiness(state, nextInterval, startedAt);
    }, interval);
  }

  private startHealthChecks(state: HealthState): void {
    const scheduleNext = () => {
      if (!this.isActive(state)) return;
      state.timer = setTimeout(async () => {
        if (!this.isActive(state)) return;
        const continueChecks = await this.check(state);
        if (continueChecks) scheduleNext();
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

  /**
   * Perform a single health check. Returns true if the health check cycle
   * should continue, false if readiness re-polling has taken over.
   */
  private async check(state: HealthState): Promise<boolean> {
    // Guard against concurrent checks
    if (state.isChecking) return true;
    if (!this.isActive(state)) return false;
    state.isChecking = true;

    try {
      const url = `http://127.0.0.1:${state.hostPort}${state.healthCheckPath}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!this.isActive(state)) return false;

        if (response.ok) {
          if (state.consecutiveFailures > 0) {
            state.consecutiveFailures = 0;
            this.onStatusChange?.(state.pluginId, "healthy");
          }
          return true;
        }
        state.consecutiveFailures++;
      } catch {
        clearTimeout(timeout);
        state.consecutiveFailures++;
      }

      if (!this.isActive(state)) return false;

      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        if (state.autoRestarts < MAX_AUTO_RESTARTS) {
          console.error(`[health] Plugin ${state.pluginId} unhealthy (${state.consecutiveFailures} failures), restarting...`);
          state.autoRestarts++;
          state.consecutiveFailures = 0;
          this.onStatusChange?.(state.pluginId, "unhealthy");

          try {
            await this.docker.stopContainer(state.containerId);
            await this.docker.startContainer(state.containerId);

            if (!this.isActive(state)) return false;

            const status = await this.docker.getStatus(state.containerId);
            if (status.hostPort) {
              state.hostPort = status.hostPort;
            }

            // Re-enter readiness phase after restart
            this.onReadyChange?.(state.pluginId, false);
            this.pollReadiness(state, READINESS_INITIAL_INTERVAL_MS, Date.now());
            return false; // stop health check cycle — readiness will restart it
          } catch (err) {
            console.error(`[health] Failed to restart plugin ${state.pluginId}:`, err);
            this.onStatusChange?.(state.pluginId, "crashed");
            this.stopMonitoring(state.pluginId);
            return false;
          }
        } else {
          console.error(`[health] Plugin ${state.pluginId} exceeded max restarts, marking crashed`);
          this.onStatusChange?.(state.pluginId, "crashed");
          this.stopMonitoring(state.pluginId);
          return false;
        }
      }

      return true;
    } finally {
      state.isChecking = false;
    }
  }
}
