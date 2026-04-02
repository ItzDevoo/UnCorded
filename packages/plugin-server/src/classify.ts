/**
 * Server SDK error classifier.
 *
 * Maps bridge HTTP errors into PluginErrorPayload so plugin developers
 * get structured, actionable error information.
 */

import type { PluginErrorPayload } from "@uncorded/shared";
import { PluginError } from "@uncorded/shared";
import {
  BridgeConfigError,
  BridgeHttpError,
  BridgeNetworkError,
  BridgeNotFoundError,
} from "./errors.js";

export function classifyServerError(err: unknown, pluginId?: string): PluginErrorPayload {
  // Already a PluginError
  if (err instanceof PluginError) {
    const payload = err.toPayload();
    if (pluginId !== undefined) payload.pluginId = pluginId;
    return payload;
  }

  if (err instanceof BridgeConfigError) {
    return {
      code: err.code,
      message: err.message,
      category: "configuration",
      retryable: false,
      ...(pluginId !== undefined ? { pluginId } : {}),
    };
  }

  if (err instanceof BridgeNotFoundError) {
    return {
      code: err.code,
      message: err.message,
      category: "validation",
      retryable: false,
      ...(pluginId !== undefined ? { pluginId } : {}),
    };
  }

  if (err instanceof BridgeNetworkError) {
    return {
      code: err.code,
      message: err.message,
      category: "network",
      retryable: true,
      ...(pluginId !== undefined ? { pluginId } : {}),
    };
  }

  if (err instanceof BridgeHttpError) {
    const status = err.statusCode;

    if (status === 403) {
      return {
        code: "FORBIDDEN",
        message: err.message,
        category: "permission",
        retryable: false,
        causeCode: err.code,
        ...(pluginId !== undefined ? { pluginId } : {}),
      };
    }

    if (status === 429) {
      return {
        code: "RATE_LIMITED",
        message: err.message,
        category: "network",
        retryable: true,
        causeCode: err.code,
        ...(pluginId !== undefined ? { pluginId } : {}),
      };
    }

    if (status >= 500) {
      return {
        code: err.code,
        message: err.message,
        category: "internal",
        retryable: true,
        ...(pluginId !== undefined ? { pluginId } : {}),
      };
    }

    return {
      code: err.code,
      message: err.message,
      category: "validation",
      retryable: false,
      ...(pluginId !== undefined ? { pluginId } : {}),
    };
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
