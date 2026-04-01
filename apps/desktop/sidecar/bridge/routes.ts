import { Elysia } from "elysia";
import type { PluginContext } from "./auth";
import type { PluginStorage } from "./storage";
import type { GatewayClient } from "../gateway/client";
import type { PluginLifecycle } from "../plugins/lifecycle";
import type { DockerManager } from "../docker/manager";
import { createApiClient } from "./api-client";
import { notificationQueue } from "./notifications";

export interface RouteDeps {
  gateway: GatewayClient;
  plugins: PluginLifecycle;
  docker: DockerManager;
  storage: PluginStorage;
}

function gatewayError() {
  return new Response(JSON.stringify({ error: "Gateway not connected" }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

function notFoundError(resource: string) {
  return new Response(JSON.stringify({ error: `${resource} not found` }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequestError(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Check if a plugin is in personal scope (plugin.scope === "personal").
 */
function isPersonalScope(plugin: PluginContext): boolean {
  return plugin.scope === "personal";
}

/**
 * Helper: get server data from gateway for the plugin's server.
 * The `plugin` property is set by the derive middleware in server.ts.
 */
function getPluginServer(gateway: GatewayClient, plugin: PluginContext) {
  const ready = gateway.getReadyData();
  if (!ready) return { ready: null, server: null };
  const server = ready.servers.find((s) => s.id === plugin.serverId);
  return { ready, server: server ?? null };
}

export function createRoutes(deps: RouteDeps) {
  const { gateway, storage } = deps;

  const api = createApiClient(
    () => deps.plugins.getApiBaseUrl(),
    () => deps.plugins.getApiToken(),
  );

  return new Elysia({ prefix: "/bridge" })

    // --- Server info ---
    .get("/server", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const ready = gateway.getReadyData();
      if (!ready) throw gatewayError();

      if (isPersonalScope(plugin)) {
        return {
          id: `personal:${ready.user.id}`,
          name: `${ready.user.displayName ?? ready.user.username}'s Space`,
          iconUrl: ready.user.avatarUrl ?? null,
          memberCount: (ready.friends?.length ?? 0) + 1,
          channelCount: ready.dmChannels?.length ?? 0,
        };
      }

      const { server } = getPluginServer(gateway, plugin);
      if (!server) throw gatewayError();

      return {
        id: server.id,
        name: server.name,
        iconUrl: server.iconUrl,
        memberCount: server.members.length,
        channelCount: server.channels.length,
      };
    })

    // --- Members ---
    .get("/members", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const ready = gateway.getReadyData();
      if (!ready) throw gatewayError();

      if (isPersonalScope(plugin)) {
        // Personal plugins see friends instead of server members
        return { members: ready.friends ?? [] };
      }

      const { server } = getPluginServer(gateway, plugin);
      if (!server) return { members: [] };

      return { members: server.members };
    })

    // --- Channels ---
    .get("/channels", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const ready = gateway.getReadyData();
      if (!ready) throw gatewayError();

      if (isPersonalScope(plugin)) {
        // Personal plugins see DM channels instead of server channels
        return { channels: ready.dmChannels ?? [] };
      }

      const { server } = getPluginServer(gateway, plugin);
      if (!server) return { channels: [] };

      return { channels: server.channels };
    })

    // --- Messages ---
    .get("/channels/:channelId/messages", async ({ params, query }) => {
      const limit = String(Math.min(Math.max(Number(query["limit"]) || 50, 1), 100));
      const before = query["before"];
      const after = query["after"];

      const res = await api.get(
        `/api/channels/${encodeURIComponent(params.channelId)}/messages`,
        { limit, before, after },
      );

      if (!res.ok) {
        throw new Response(await res.text(), {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      return res.json();
    })

    .post("/channels/:channelId/messages", async (ctx) => {
      const { params } = ctx;
      const body = (ctx as unknown as { body: unknown }).body as Record<string, unknown> | null;
      const content = body?.content;

      if (typeof content !== "string" || content.trim().length === 0) {
        throw badRequestError("'content' must be a non-empty string");
      }

      const res = await api.post(
        `/api/channels/${encodeURIComponent(params.channelId)}/messages`,
        { content },
      );

      if (!res.ok) {
        throw new Response(await res.text(), {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const message = await res.json();
      return { sent: true, message };
    })

    // --- Users (restricted to caller's server) ---
    .get("/users/:userId", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const { ready, server } = getPluginServer(gateway, plugin);
      if (!ready) throw gatewayError();
      if (!server) throw notFoundError("Server");

      const member = server.members.find((m) => m.id === (ctx as unknown as { params: { userId: string } }).params.userId);
      if (!member) throw notFoundError("User");

      return member;
    })

    // --- Presence ---
    .get("/presence", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const ready = gateway.getReadyData();
      if (!ready) return { presence: [] };

      if (isPersonalScope(plugin)) {
        // Personal plugins derive presence from friends list
        const friends = ready.friends as Array<{ userId: string; status?: string }> | undefined;
        return {
          presence: (friends ?? []).map((f) => ({
            userId: f.userId,
            status: f.status ?? "offline",
          })),
        };
      }

      const { server } = getPluginServer(gateway, plugin);
      if (!server) return { presence: [] };

      return {
        presence: server.members.map((m) => ({
          userId: m.id,
          status: m.status ?? "offline",
        })),
      };
    })

    // --- Notifications ---
    .post("/notify", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const body = (ctx as unknown as { body: unknown }).body as Record<string, unknown> | null;

      const title = body?.title;
      const bodyText = body?.body;

      if (typeof title !== "string" || title.trim().length === 0) {
        throw badRequestError("'title' must be a non-empty string");
      }
      if (typeof bodyText !== "string" || bodyText.trim().length === 0) {
        throw badRequestError("'body' must be a non-empty string");
      }

      const level = body?.level;
      const validLevels = ["info", "warning", "error"] as const;
      const resolvedLevel = typeof level === "string" && (validLevels as readonly string[]).includes(level)
        ? (level as "info" | "warning" | "error")
        : "info";

      notificationQueue.push({
        pluginId: plugin.pluginId,
        title,
        body: bodyText,
        level: resolvedLevel,
        timestamp: Date.now(),
      });

      return { sent: true };
    })

    // --- Plugin config ---
    .get("/config", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const config = storage.get(plugin.pluginId, "__config");
      return { config: config ?? {} };
    })

    // --- KV Storage ---
    .get("/storage/:key", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const params = (ctx as unknown as { params: { key: string } }).params;
      const value = storage.get(plugin.pluginId, params.key);
      if (value === null) throw notFoundError("Key");
      return { key: params.key, value };
    })

    .put("/storage/:key", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const params = (ctx as unknown as { params: { key: string } }).params;
      const query = (ctx as unknown as { query: Record<string, string | undefined> }).query;
      const body = (ctx as unknown as { body: unknown }).body;

      // Validate body
      if (typeof body !== "object" || body === null || !("value" in body)) {
        throw badRequestError("Request body must be an object with a 'value' property");
      }

      const encrypt = query["encrypt"] === "true";
      const result = storage.set(
        plugin.pluginId,
        params.key,
        (body as Record<string, unknown>).value,
        encrypt,
      );
      if (!result.success) throw badRequestError(result.error ?? "Storage error");
      return { key: params.key, stored: true };
    })

    .delete("/storage/:key", (ctx) => {
      const plugin = (ctx as unknown as { plugin: PluginContext }).plugin;
      const params = (ctx as unknown as { params: { key: string } }).params;
      const deleted = storage.delete(plugin.pluginId, params.key);
      return { key: params.key, deleted };
    });
}
