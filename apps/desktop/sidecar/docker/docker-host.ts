import { execSync } from "node:child_process";
import Dockerode from "dockerode";

const DEFAULT_TCP_PORT = 2375;
const PROXY_CONTAINER_NAME = "docker-tcp-proxy";

interface DockerHostConfig {
  host: string;
  port: number;
}

/**
 * Parse DOCKER_HOST env var (tcp:// format) into a validated host/port pair.
 * Falls back to port 2375 when the port is omitted or invalid.
 */
export function parseDockerHost(dockerHost: string): DockerHostConfig {
  const url = new URL(dockerHost.replace("tcp://", "http://"));
  const parsed = Number(url.port);
  return {
    host: url.hostname,
    port: parsed > 0 ? parsed : DEFAULT_TCP_PORT,
  };
}

/**
 * Ensure the Docker TCP proxy container is running on Windows.
 * Bun can't connect to Windows named pipes, so we use alpine/socat
 * to bridge TCP 2375 → /var/run/docker.sock inside Docker Desktop's VM.
 */
function ensureWindowsTcpProxy(): void {
  try {
    // Check if proxy is already running
    const running = execSync(
      `docker ps --filter name=${PROXY_CONTAINER_NAME} --format "{{.Names}}"`,
      { encoding: "utf-8", timeout: 10_000 },
    ).trim();

    if (running === PROXY_CONTAINER_NAME) return;

    // Check if container exists but is stopped
    const exists = execSync(
      `docker ps -a --filter name=${PROXY_CONTAINER_NAME} --format "{{.Names}}"`,
      { encoding: "utf-8", timeout: 10_000 },
    ).trim();

    if (exists === PROXY_CONTAINER_NAME) {
      console.log(`[docker] Starting existing TCP proxy container`);
      execSync(`docker start ${PROXY_CONTAINER_NAME}`, { timeout: 15_000 });
    } else {
      console.log(`[docker] Creating TCP proxy container`);
      execSync(
        `docker run -d --name ${PROXY_CONTAINER_NAME} --restart always ` +
          `-p 2375:2375 -v //var/run/docker.sock:/var/run/docker.sock ` +
          `alpine/socat TCP-LISTEN:2375,fork,reuseaddr UNIX-CONNECT:/var/run/docker.sock`,
        { timeout: 60_000 },
      );
    }

    // Brief pause for the proxy to accept connections
    Bun.sleepSync(1500);
  } catch (err) {
    console.error(`[docker] Failed to ensure TCP proxy:`, err);
  }
}

/**
 * Create a Dockerode client with platform-aware connection handling.
 * - Respects DOCKER_HOST env var (tcp:// scheme)
 * - Falls back to TCP proxy on Windows (Bun can't use named pipes)
 * - Uses default Unix socket on other platforms
 */
export function createDockerClient(): Dockerode {
  const dockerHost = process.env["DOCKER_HOST"];
  if (dockerHost && dockerHost.startsWith("tcp://")) {
    const { host, port } = parseDockerHost(dockerHost);
    return new Dockerode({ host, port });
  }
  if (process.platform === "win32") {
    ensureWindowsTcpProxy();
    return new Dockerode({ host: "127.0.0.1", port: DEFAULT_TCP_PORT });
  }
  return new Dockerode();
}
