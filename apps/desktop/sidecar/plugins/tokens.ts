import { randomBytes, createHash } from "node:crypto";
import { registerToken, revokeAllForPlugin, type PluginContext } from "../bridge/auth";

const TOKEN_BYTES = 32; // 256-bit

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueToken(pluginId: string, serverId: string, permissions: string[]): string {
  // Revoke any existing tokens for this plugin
  revokeAllForPlugin(pluginId);

  // Generate and register new token
  const token = generateToken();
  const context: PluginContext = { pluginId, serverId, permissions };
  registerToken(token, context);

  return token;
}

export function revokePluginTokens(pluginId: string): void {
  revokeAllForPlugin(pluginId);
}
