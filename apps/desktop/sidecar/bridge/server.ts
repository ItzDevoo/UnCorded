import { Elysia } from "elysia";
import { validateToken } from "./auth";
import { checkPermission } from "./permissions";
import { PluginStorage } from "./storage";
import { createRoutes } from "./routes";
import type { DockerManager } from "../docker/manager";
import type { GatewayClient } from "../gateway/client";
import type { PluginLifecycle } from "../plugins/lifecycle";

interface BridgeServerOptions {
  docker: DockerManager;
  gateway: GatewayClient;
  plugins: PluginLifecycle;
  port?: number;
  dataDir?: string;
}

interface BridgeServer {
  port: number;
  stop: () => Promise<void>;
}

export async function startBridgeServer(options: BridgeServerOptions): Promise<BridgeServer> {
  const dataDir = options.dataDir ?? process.env["UNCORDED_DATA_DIR"] ?? "./sidecar-data";
  const storage = new PluginStorage(dataDir);

  const app = new Elysia()
    // Health check (unauthenticated)
    .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

    // Auth + permissions middleware for /bridge/* routes
    .derive(({ request, path }) => {
      // Skip auth for non-bridge routes
      if (!path.startsWith("/bridge")) return {};

      const plugin = validateToken(request.headers.get("authorization") ?? undefined);
      if (!plugin) {
        throw new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check permissions
      const method = request.method;
      const permCheck = checkPermission(method, path, plugin.permissions);
      if (!permCheck.allowed) {
        throw new Response(
          JSON.stringify({
            error: "Forbidden",
            requiredPermission: permCheck.requiredPermission,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return { plugin };
    })

    // Mount bridge routes
    .use(
      createRoutes({
        docker: options.docker,
        gateway: options.gateway,
        plugins: options.plugins,
        storage,
      }),
    );

  // Listen on loopback only
  const port = options.port ?? 0;
  const server = app.listen({ hostname: "127.0.0.1", port });

  const assignedPort = server.server?.port ?? port;
  console.error(`[bridge] Listening on 127.0.0.1:${assignedPort}`);

  return {
    port: assignedPort,
    stop: async () => {
      await app.stop();
    },
  };
}
