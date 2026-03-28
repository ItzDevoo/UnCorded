import { randomBytes } from "node:crypto";
import { registerToken, revokeAllForPlugin, hashToken, type PluginContext } from "../bridge/auth";

const TOKEN_BYTES = 32; // 256-bit

export { hashToken };

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
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
