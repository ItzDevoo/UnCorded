/**
 * Shell-side error classifier for plugin bridge handler errors.
 *
 * Maps thrown values from bridge request handlers into PluginErrorPayload
 * so the plugin receives structured, actionable error information.
 */

import type { PluginErrorPayload, PluginErrorCategory } from "@uncorded/shared";

// ── Code → category mapping ──────────────────────────────────────────────

const CODE_MAP: Record<string, { category: PluginErrorCategory; retryable: boolean }> = {
  BAD_REQUEST: { category: "validation", retryable: false },
  FORBIDDEN: { category: "permission", retryable: false },
  UNKNOWN_METHOD: { category: "validation", retryable: false },
  NOT_FOUND: { category: "validation", retryable: false },
  RATE_LIMITED: { category: "network", retryable: true },
  UNAUTHORIZED: { category: "permission", retryable: false },
};

// ── Classifier ────────────────────────────────────────────────────────────

export function classifyBridgeError(err: unknown, pluginId: string): PluginErrorPayload {
  // Already a PluginErrorPayload (from deeper layer)
  if (
    typeof err === "object" &&
    err !== null &&
    "category" in err &&
    "retryable" in err &&
    "code" in err &&
    "message" in err
  ) {
    const p = err as PluginErrorPayload;
    return { ...p, pluginId };
  }

  // Plain object with code/message (thrown by shell handlers like sendMessage)
  if (typeof err === "object" && err !== null) {
    const typed = err as { code?: string; message?: string };
    const code = typed.code ?? "INTERNAL_ERROR";
    const message = typed.message ?? "An unexpected error occurred";
    const mapping = CODE_MAP[code];

    return {
      code,
      message,
      category: mapping?.category ?? "internal",
      retryable: mapping?.retryable ?? false,
      pluginId,
    };
  }

  // Anything else (string throws, etc.)
  return {
    code: "INTERNAL_ERROR",
    message: typeof err === "string" ? err : "An unexpected error occurred",
    category: "internal",
    retryable: false,
    pluginId,
  };
}
