import { AppError, PluginError } from "@uncorded/shared";
import type { PluginErrorCategory } from "@uncorded/shared";

/** Base error for all plugin bridge errors. */
export class BridgeError extends AppError {
  constructor(code: string, message: string) {
    super("BridgeError", 0, code, message);
  }

  toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "internal", false, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when a bridge request times out. */
export class RequestTimeoutError extends BridgeError {
  readonly method: string;
  readonly requestId: string;

  constructor(method: string, requestId: string, timeoutMs: number) {
    super("REQUEST_TIMEOUT", `Request "${method}" (${requestId}) timed out after ${timeoutMs}ms`);
    this.method = method;
    this.requestId = requestId;
  }

  override toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "network", true, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when the plugin is destroyed while requests are pending. */
export class PluginDestroyedError extends BridgeError {
  constructor() {
    super("PLUGIN_DESTROYED", "Plugin was destroyed while requests were pending");
  }

  override toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "lifecycle", false, {
      pluginId,
      causeCode: this.code,
    });
  }
}

// Re-export for plugin consumers
export { PluginError };
export type { PluginErrorCategory };
