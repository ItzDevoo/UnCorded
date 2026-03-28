import { Elysia } from "elysia";
import type { PluginContext } from "./auth";
import type { PluginStorage } from "./storage";
import type { GatewayClient } from "../gateway/client";
import type { PluginLifecycle } from "../plugins/lifecycle";
import type { DockerManager } from "../docker/manager";

export interface RouteDeps {
  gateway: GatewayClient;
  plugins: PluginLifecycle;
  docker: DockerManager;
  storage: PluginStorage;
}

export function createRoutes(deps: RouteDeps) {
  const { gateway, storage } = deps;

  return new Elysia({ prefix: "/bridge" })

    // --- Server info ---
    .get("/server", ({ store }) => {
      const ctx = store as { plugin: PluginContext };
      const ready = gateway.getReadyData();
      if (!ready) return { error: "Gateway not connected" };

      const server = ready.servers.find((s) => s.id === ctx.plugin.serverId);
      if (!server) return { error: "Server not found" };

      return {
        id: server.id,
        name: server.name,
        iconUrl: server.iconUrl,
        memberCount: server.members.length,
        channelCount: server.channels.length,
      };
    })

    // --- Members ---
    .get("/members", ({ store }) => {
      const ctx = store as { plugin: PluginContext };
      const ready = gateway.getReadyData();
      if (!ready) return { error: "Gateway not connected" };

      const server = ready.servers.find((s) => s.id === ctx.plugin.serverId);
      if (!server) return { members: [] };

      return { members: server.members };
    })

    // --- Channels ---
    .get("/channels", ({ store }) => {
      const ctx = store as { plugin: PluginContext };
      const ready = gateway.getReadyData();
      if (!ready) return { error: "Gateway not connected" };

      const server = ready.servers.find((s) => s.id === ctx.plugin.serverId);
      if (!server) return { channels: [] };

      return { channels: server.channels };
    })

    // --- Messages ---
    .get("/channels/:channelId/messages", ({ params, query }) => {
      return {
        channelId: params.channelId,
        messages: [],
        limit: query["limit"] ?? 50,
      };
    })

    .post("/channels/:channelId/messages", ({ params }) => {
      return {
        channelId: params.channelId,
        sent: false,
        error: "Message sending not yet implemented",
      };
    })

    // --- Users ---
    .get("/users/:userId", ({ params }) => {
      const ready = gateway.getReadyData();
      if (!ready) return { error: "Gateway not connected" };

      for (const server of ready.servers) {
        const member = server.members.find((m) => m.id === params.userId);
        if (member) return member;
      }

      return { error: "User not found" };
    })

    // --- Presence ---
    .get("/presence", () => {
      return { presence: [] };
    })

    // --- Notifications ---
    .post("/notify", () => {
      return { sent: false, error: "Notifications not yet implemented" };
    })

    // --- Plugin config ---
    .get("/config", ({ store }) => {
      const ctx = store as { plugin: PluginContext };
      const config = storage.get(ctx.plugin.pluginId, "__config");
      return { config: config ?? {} };
    })

    // --- KV Storage ---
    .get("/storage/:key", ({ params, store }) => {
      const ctx = store as { plugin: PluginContext };
      const value = storage.get(ctx.plugin.pluginId, params.key);
      if (value === null) return { error: "Key not found" };
      return { key: params.key, value };
    })

    .put("/storage/:key", ({ params, body, query, store }) => {
      const ctx = store as { plugin: PluginContext };
      const encrypt = query["encrypt"] === "true";
      const result = storage.set(
        ctx.plugin.pluginId,
        params.key,
        (body as Record<string, unknown>).value,
        encrypt,
        encrypt ? ctx.plugin.pluginId : undefined,
      );
      if (!result.success) return { error: result.error };
      return { key: params.key, stored: true };
    })

    .delete("/storage/:key", ({ params, store }) => {
      const ctx = store as { plugin: PluginContext };
      const deleted = storage.delete(ctx.plugin.pluginId, params.key);
      return { key: params.key, deleted };
    });
}
