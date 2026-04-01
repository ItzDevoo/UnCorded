/**
 * postMessage bridge — UnCorded shell side.
 *
 * Receives requests from plugin iframes, validates origin + permissions,
 * dispatches handlers, and pushes gateway events to subscribed plugins.
 */

import type { ChannelId } from "@uncorded/protocol";
import { readyData, channelCache } from "./gateway-store.js";
import { api } from "./api.js";
import {
  plugins,
  type PluginInfo,
} from "../stores/plugin-store.js";
import { selectedServerId } from "../stores/app-store.js";
import { showToast } from "../components/ui/toast.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface PluginRequest {
  type: "uncorded:request";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface PluginResponse {
  type: "uncorded:response";
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
}

interface PluginEvent {
  type: "uncorded:event";
  event: string;
  data: unknown;
}

// ── Origin allowlist ───────────────────────────────────────────────────────

const allowedOrigins = new Map<string, string>(); // origin → pluginId

export function updateAllowedOrigins(list: PluginInfo[]): void {
  allowedOrigins.clear();
  for (const p of list) {
    if (p.status === "running") {
      allowedOrigins.set(`http://localhost:${p.port}`, p.id);
    }
  }
}

// ── Permission checking ────────────────────────────────────────────────────

const METHOD_PERMISSIONS: Record<string, string | null> = {
  getUser: null,
  getServer: null,
  getChannels: null,
  getMembers: "members.read",
  getPresence: "presence.read",
  sendMessage: "messages.send",
  showToast: "notifications.send",
  navigate: null,
};

function checkPermission(pluginId: string, method: string): boolean {
  const required = METHOD_PERMISSIONS[method];
  if (required === null) return true;
  if (required === undefined) return false; // unknown method → deny
  const plugin = plugins().find((p) => p.id === pluginId);
  return plugin?.permissions?.includes(required) ?? false;
}

// ── Request handlers ───────────────────────────────────────────────────────

type HandlerFn = (pluginId: string, params: Record<string, unknown>) => Promise<unknown>;

const handlers: Record<string, HandlerFn> = {
  async getUser() {
    const u = readyData.data?.user;
    if (!u) return null;
    return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl };
  },

  async getServer() {
    const serverId = selectedServerId();
    if (!serverId) return null;
    const s = readyData.data?.servers.find((sv) => sv.id === serverId);
    if (!s) return null;
    return { id: s.id, name: s.name, iconUrl: s.iconUrl, ownerId: s.ownerId };
  },

  async getChannels() {
    const serverId = selectedServerId();
    if (!serverId) return [];
    const cached = channelCache[serverId];
    if (!cached) return [];
    return cached.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      position: c.position,
      topic: c.topic,
    }));
  },

  async getMembers() {
    const serverId = selectedServerId();
    if (!serverId) return [];
    const members = await api<unknown[]>(`/api/servers/${serverId}/members`);
    return members;
  },

  async getPresence() {
    const serverId = selectedServerId();
    if (!serverId) return [];
    const presence = await api<unknown[]>(`/api/servers/${serverId}/presence`);
    return presence;
  },

  async sendMessage(pluginId, params) {
    const channelId = params.channelId as ChannelId | undefined;
    const content = params.content as string | undefined;
    if (!channelId || !content) {
      throw { code: "BAD_REQUEST", message: "channelId and content are required" };
    }
    if (content.length > 4000) {
      throw { code: "BAD_REQUEST", message: "Message content too long (max 4000 characters)" };
    }
    // Verify the channel belongs to the current server
    const serverId = selectedServerId();
    if (!serverId) {
      throw { code: "BAD_REQUEST", message: "No server selected" };
    }
    const channels = channelCache[serverId];
    if (!channels?.some((c) => c.id === channelId)) {
      throw { code: "BAD_REQUEST", message: "Channel not found in current server" };
    }
    const plugin = plugins().find((p) => p.id === pluginId);
    if (!plugin) {
      throw { code: "BAD_REQUEST", message: `Plugin not found: ${pluginId}` };
    }
    const prefixedContent = `[${plugin.name}] ${content}`;
    await api(`/api/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: prefixedContent }),
    });
    return { sent: true };
  },

  async showToast(_pluginId, params) {
    const message = params.message as string | undefined;
    const toastType = (params.type as "info" | "error") ?? "info";
    if (!message) {
      throw { code: "BAD_REQUEST", message: "message is required" };
    }
    showToast(message, toastType);
    return { shown: true };
  },

  async navigate(_pluginId, params) {
    const to = params.to as string | undefined;
    const channelId = params.channelId as string | undefined;
    if (to === "channel" && channelId) {
      // Validate that the channel exists in the current server
      const serverId = selectedServerId();
      if (!serverId) {
        return { navigated: false };
      }
      const channels = channelCache[serverId];
      if (!channels?.some((c) => c.id === (channelId as ChannelId))) {
        return { navigated: false };
      }
      const { setSelectedChannelId } = await import("../stores/app-store.js");
      const { clearActivePlugin } = await import("../stores/plugin-store.js");
      clearActivePlugin();
      setSelectedChannelId(channelId as ChannelId);
      return { navigated: true };
    }
    return { navigated: false };
  },
};

// ── Message listener ───────────────────────────────────────────────────────

function sendResponse(source: MessageEventSource, origin: string, response: PluginResponse): void {
  (source as WindowProxy).postMessage(response, origin);
}

async function handleMessage(event: MessageEvent): Promise<void> {
  const pluginId = allowedOrigins.get(event.origin);
  if (!pluginId) return; // unknown origin — silently ignore

  // Reject oversized messages (64KB limit)
  try {
    if (typeof event.data === "object" && JSON.stringify(event.data).length > 65_536) return;
  } catch { return; }

  const data = event.data as PluginRequest | undefined;
  if (!data || data.type !== "uncorded:request" || !data.id || !data.method) return;

  const source = event.source;
  if (!source) return;

  // Permission check
  if (!checkPermission(pluginId, data.method)) {
    const required = METHOD_PERMISSIONS[data.method];
    sendResponse(source, event.origin, {
      type: "uncorded:response",
      id: data.id,
      error: {
        code: "FORBIDDEN",
        message: `Missing permission: ${required ?? data.method}`,
      },
    });
    return;
  }

  // Dispatch to handler
  const handler = handlers[data.method];
  if (!handler) {
    sendResponse(source, event.origin, {
      type: "uncorded:response",
      id: data.id,
      error: { code: "UNKNOWN_METHOD", message: `Unknown method: ${data.method}` },
    });
    return;
  }

  try {
    const result = await handler(pluginId, data.params ?? {});
    sendResponse(source, event.origin, {
      type: "uncorded:response",
      id: data.id,
      result,
    });
  } catch (err) {
    const typed = err as { code?: string; message?: string };
    sendResponse(source, event.origin, {
      type: "uncorded:response",
      id: data.id,
      error: {
        code: typed.code ?? "INTERNAL_ERROR",
        message: typed.message ?? "An unexpected error occurred",
      },
    });
  }
}

// ── Event broadcasting ─────────────────────────────────────────────────────

/**
 * Push a gateway event to all running plugin iframes that hold the required permission.
 * Call this from gateway event handlers (message-store, presence-store, etc.).
 */
export function broadcastToPlugins(eventName: string, data: unknown, requiredPermission: string | null): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe[data-plugin-id]");

  for (const iframe of iframes) {
    const pid = iframe.dataset.pluginId;
    if (!pid) continue;

    const plugin = plugins().find((p) => p.id === pid);
    if (!plugin || plugin.status !== "running") continue;

    if (requiredPermission && !plugin.permissions.includes(requiredPermission)) continue;

    const origin = `http://localhost:${plugin.port}`;
    const msg: PluginEvent = { type: "uncorded:event", event: eventName, data };
    iframe.contentWindow?.postMessage(msg, origin);
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let listening = false;

export function setupPluginBridge(): void {
  if (listening) return;
  listening = true;
  window.addEventListener("message", handleMessage);
}

export function teardownPluginBridge(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener("message", handleMessage);
  allowedOrigins.clear();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => teardownPluginBridge());
}
