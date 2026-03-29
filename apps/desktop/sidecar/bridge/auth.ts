import { createHash } from "node:crypto";

export type ResolvedScope = "server" | "personal";

export interface PluginContext {
  pluginId: string;
  serverId: string;
  scope: ResolvedScope;
  permissions: string[];
}

// In-memory token store: hash → plugin context
const tokenStore = new Map<string, PluginContext>();

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registerToken(token: string, context: PluginContext): void {
  const hash = hashToken(token);
  tokenStore.set(hash, context);
}

export function revokeToken(token: string): void {
  const hash = hashToken(token);
  tokenStore.delete(hash);
}

export function revokeAllForPlugin(pluginId: string): void {
  for (const [hash, ctx] of tokenStore) {
    if (ctx.pluginId === pluginId) {
      tokenStore.delete(hash);
    }
  }
}

export function validateToken(bearerHeader: string | undefined): PluginContext | null {
  if (!bearerHeader) return null;

  const token = bearerHeader.startsWith("Bearer ")
    ? bearerHeader.slice(7)
    : bearerHeader;

  if (!token) return null;

  const hash = hashToken(token);
  return tokenStore.get(hash) ?? null;
}
