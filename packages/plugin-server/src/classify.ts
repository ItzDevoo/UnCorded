/**
 * Server SDK error classifier.
 *
 * Maps bridge HTTP errors into PluginErrorPayload so plugin developers
 * get structured, actionable error information.
 *
 * Delegates to each error class's toPluginError() method to avoid
 * duplicating the mapping logic.
 */

import type { PluginErrorPayload } from "@uncorded/shared";
import { PluginError } from "@uncorded/shared";
import { BridgeError } from "./errors.js";

export function classifyServerError(err: unknown, pluginId?: string): PluginErrorPayload {
  // Already a PluginError — serialize directly
  if (err instanceof PluginError) {
    const payload = err.toPayload();
    if (pluginId !== undefined) payload.pluginId = pluginId;
    return payload;
  }

  // Any BridgeError subclass — delegate to its toPluginError()
  if (err instanceof BridgeError) {
    const payload = err.toPluginError(pluginId).toPayload();
    return payload;
  }

  // Unknown error
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  return {
    code: "INTERNAL_ERROR",
    message,
    category: "internal",
    retryable: false,
    ...(pluginId !== undefined ? { pluginId } : {}),
  };
}
