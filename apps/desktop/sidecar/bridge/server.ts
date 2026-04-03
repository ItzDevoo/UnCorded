import { Elysia } from "elysia";
import { validateToken } from "./auth";
import { checkPermission } from "./permissions";
import { PluginStorage } from "./storage";
import { createRoutes } from "./routes";
import { notificationQueue } from "./notifications";
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
  const inFlightUpdates = new Set<string>();

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
        sidebar: p.manifest.ui?.sidebar ?? false,
        status: p.state === "installed" ? "stopped" : p.state,
        ready: p.ready,
        port: p.hostPort ?? 0,
        scope: p.scope,
        tunnelUrl: p.tunnelUrl,
        permissions: p.manifest.permissions,
        errorPayload: p.errorPayload ?? null,
      }));
    })

    .post("/plugins/install", async ({ body }) => {
      const parsed = body as Record<string, unknown> | null;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("manifest" in parsed) ||
        parsed.manifest == null
      ) {
        throw new Response(
          JSON.stringify({ error: "Request body must include a 'manifest' object" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      const scope = parsed.scope === "server" ? ("server" as const) : ("personal" as const);
      const serverId = typeof parsed.serverId === "string" ? parsed.serverId : undefined;

      // Server-scoped installs must provide a real serverId
      if (scope === "server" && !serverId) {
        throw new Response(
          JSON.stringify({ error: "serverId is required for server-scoped plugins" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const result = await options.plugins.install(parsed.manifest, serverId ?? "local", scope);
      if (result.errors && result.errors.length > 0) {
        throw new Response(JSON.stringify({ error: result.errors.join(", ") }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return { pluginId: result.pluginId, installed: true };
    })

    .post("/plugins/:id/start", async ({ params }) => {
      try {
        await options.plugins.start(params.id);
        return { pluginId: params.id, started: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Response(JSON.stringify({ error: message, pluginId: params.id }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    })

    .post("/plugins/:id/stop", async ({ params }) => {
      try {
        await options.plugins.stop(params.id);
        return { pluginId: params.id, stopped: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Response(JSON.stringify({ error: message, pluginId: params.id }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    })

    .post("/plugins/:id/restart", async ({ params }) => {
      try {
        await options.plugins.restart(params.id);
        return { pluginId: params.id, restarted: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Response(JSON.stringify({ error: message, pluginId: params.id }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
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

    // --- Auth config (called by Electron main process, no auth) ---
    .post("/auth", ({ body }) => {
      const parsed = body as Record<string, unknown> | null;
      const token = parsed?.token;
      if (!token || typeof token !== "string") {
        throw new Response(JSON.stringify({ error: "token required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("[bridge] Auth token received");
      options.plugins.setApiToken(token);

      // Trigger plugin update check now that auth is available
      import("../index")
        .then((m) => m.runUpdateCheck())
        .catch((err) => console.error("[bridge] runUpdateCheck failed after auth:", err));

      return { success: true };
    })

    // --- Notifications (called by Electron main process, no auth) ---
    .get("/notifications/pending", () => {
      return notificationQueue.drain();
    })

    // --- Plugin updates (called by Electron main process, no auth) ---

    .get("/plugins/updates", async () => {
      const { pendingMajorUpdates } = await import("../index");
      return { updates: [...pendingMajorUpdates] };
    })

    .post("/plugins/:id/update", async ({ params }) => {
      const { removePendingUpdate, reinsertPendingUpdate } = await import("../index");

      // If already in-flight, return 202 so the client knows it's being processed
      if (inFlightUpdates.has(params.id)) {
        return new Response(JSON.stringify({ status: "in_progress" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Atomically remove the pending update
      const update = removePendingUpdate(params.id);
      if (!update) {
        throw new Response(JSON.stringify({ error: "No pending update for this plugin" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      inFlightUpdates.add(params.id);
      let result: { errors?: string[] };
      try {
        result = await options.plugins.update(params.id, update.manifest);
      } catch (err) {
        inFlightUpdates.delete(params.id);
        reinsertPendingUpdate(update);
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      inFlightUpdates.delete(params.id);

      if (result.errors && result.errors.length > 0) {
        const joined = result.errors.join(", ");
        // Permanent validation failures — don't requeue
        const isPermanent = result.errors.some((e) => /not found|manifest|scope|parse/i.test(e));
        if (!isPermanent) {
          reinsertPendingUpdate(update);
        }
        const status = isPermanent ? 400 : 500;
        throw new Response(JSON.stringify({ error: joined }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }

      return { success: true, version: update.availableVersion };
    })

    .post("/plugins/:id/uninstall", async ({ params }) => {
      try {
        await options.plugins.uninstall(params.id);
        return { pluginId: params.id, uninstalled: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Response(JSON.stringify({ error: message, pluginId: params.id }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
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
