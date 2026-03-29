/** Current user info. */
export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Server info. */
export interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
}

/** A channel. */
export interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
}

/** A server member. */
export interface Member {
  id: string;
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
  channelId: string;
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
  error?: { code: string; message: string };
}

/** postMessage event (shell → plugin). */
export interface PluginEvent {
  type: "uncorded:event";
  event: string;
  data: unknown;
}

/** Event handler function. */
export type EventHandler<T = unknown> = (data: T) => void;
