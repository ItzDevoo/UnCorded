import Dockerode from "dockerode";

const DEFAULT_TCP_PORT = 2375;

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
    return new Dockerode({ host: "127.0.0.1", port: DEFAULT_TCP_PORT });
  }
  return new Dockerode();
}
