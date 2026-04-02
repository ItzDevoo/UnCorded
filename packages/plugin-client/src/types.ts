import type { ChannelId, ServerId, UserId } from "@uncorded/protocol";

/** Current user info. */
export interface User {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Server info. */
export interface Server {
  id: ServerId;
  name: string;
  iconUrl: string | null;
  ownerId: UserId;
}

/** A channel. */
export interface Channel {
  id: ChannelId;
  name: string;
  type: string;
  position: number;
}

/** A server member. */
export interface Member {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  joinedAt: string;
}

/** Toast notification type. */
export type ToastType = "info" | "success" | "warning" | "error";

/** Navigate target. */
export interface NavigateParams {
  to: "channel";
  channelId: ChannelId;
}

/** postMessage request (plugin → shell). */
export interface PluginRequest {
  type: "uncorded:request";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/** postMessage response (shell → plugin). */
export interface PluginResponse {
  type: "uncorded:response";
  id: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    category?: string;
    retryable?: boolean;
    pluginId?: string;
    causeCode?: string;
  };
}

/** postMessage event (shell → plugin). */
export interface PluginEvent {
  type: "uncorded:event";
  event: string;
  data: unknown;
}

/** Event handler function. */
export type EventHandler<T = unknown> = (data: T) => void;

/** Plugin constructor options. */
export interface PluginOptions {
  /** Origin of the shell window. Defaults to `document.referrer` origin. */
  shellOrigin?: string;
  /** Request timeout in ms. Defaults to 30000. */
  timeoutMs?: number;
}
