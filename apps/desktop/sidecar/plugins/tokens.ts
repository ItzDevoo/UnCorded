import { randomBytes } from "node:crypto";
import { registerToken, revokeAllForPlugin, hashToken, type PluginContext, type ResolvedScope } from "../bridge/auth";

const TOKEN_BYTES = 32; // 256-bit

export { hashToken };

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function issueToken(
  pluginId: string,
  serverId: string,
  permissions: string[],
  scope: ResolvedScope = "personal",
): string {
  // Revoke any existing tokens for this plugin
  revokeAllForPlugin(pluginId);

  // Generate and register new token
  const token = generateToken();
  const context: PluginContext = { pluginId, serverId, scope, permissions };
  registerToken(token, context);

  return token;
}

export function revokePluginTokens(pluginId: string): void {
  revokeAllForPlugin(pluginId);
}
