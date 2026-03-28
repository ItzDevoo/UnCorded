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

    // --- Plugin management (called by Electron main process, no auth) ---
    .get("/plugins", () => {
      return options.plugins.list().map((p) => ({
        id: p.pluginId,
        name: p.manifest.name,
        icon: p.manifest.icon ?? null,
        uiSlot: p.manifest.ui?.type ?? "content",
        header: false,
        rightPanel: false,
        status: p.state === "installed" ? "stopped" : p.state,
        port: p.hostPort ?? 0,
        permissions: p.manifest.permissions,
      }));
    })

    .post("/plugins/install", async ({ body }) => {
      const { manifest, serverId } = body as { manifest: unknown; serverId?: string };
      const result = await options.plugins.install(manifest, serverId ?? "local");
      if (result.errors && result.errors.length > 0) {
        throw new Response(JSON.stringify({ error: result.errors.join(", ") }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return { pluginId: result.pluginId, installed: true };
    })

    .post("/plugins/:id/start", async ({ params }) => {
      await options.plugins.start(params.id);
      return { pluginId: params.id, started: true };
    })

    .post("/plugins/:id/stop", async ({ params }) => {
      await options.plugins.stop(params.id);
      return { pluginId: params.id, stopped: true };
    })

    .post("/plugins/:id/restart", async ({ params }) => {
      await options.plugins.restart(params.id);
      return { pluginId: params.id, restarted: true };
    })

    .get("/plugins/:id/permissions", ({ params }) => {
      const plugin = options.plugins.get(params.id);
      if (!plugin) {
        throw new Response(JSON.stringify({ error: "Plugin not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return plugin.manifest.permissions;
    })

    .post("/plugins/:id/uninstall", async ({ params }) => {
      await options.plugins.uninstall(params.id);
      return { pluginId: params.id, uninstalled: true };
    })

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
