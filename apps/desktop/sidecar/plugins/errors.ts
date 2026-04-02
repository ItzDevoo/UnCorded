/**
 * Sidecar lifecycle error classifier.
 *
 * Maps Docker and health monitor failures into PluginErrorPayload
 * so the frontend can show specific, actionable error messages.
 */

import type { PluginErrorPayload, PluginErrorCategory } from "@uncorded/shared";

export function classifyLifecycleError(
  reason: string,
  pluginId: string,
): PluginErrorPayload {
  const lower = reason.toLowerCase();

  let category: PluginErrorCategory = "lifecycle";
  let retryable = false;
  let code = "PLUGIN_CRASHED";

  if (lower.includes("readiness timed out")) {
    code = "READINESS_TIMEOUT";
    retryable = true;
  } else if (lower.includes("max restarts") || lower.includes("exceeded maximum")) {
    code = "MAX_RESTARTS_EXCEEDED";
    retryable = false;
  } else if (lower.includes("restart failed") || lower.includes("failed to restart")) {
    code = "RESTART_FAILED";
    retryable = false;
  } else if (lower.includes("exited with code")) {
    code = "CONTAINER_EXITED";
    retryable = true;
  } else if (lower.includes("tunnel")) {
    category = "network";
    code = "TUNNEL_FAILED";
    retryable = true;
  } else if (lower.includes("config") || lower.includes("manifest") || lower.includes("scope")) {
    category = "configuration";
    code = "CONFIG_ERROR";
    retryable = false;
  } else if (lower.includes("resource") || lower.includes("memory") || lower.includes("oom")) {
    category = "resource";
    code = "RESOURCE_EXCEEDED";
    retryable = false;
  } else if (lower.includes("failed to resume")) {
    code = "RESUME_FAILED";
    retryable = true;
  }

  return {
    code,
    message: reason,
    category,
    retryable,
    pluginId,
  };
}
