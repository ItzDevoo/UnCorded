import { AppError, PluginError } from "@uncorded/shared";
import type { PluginErrorCategory } from "@uncorded/shared";

/** Base error for all bridge HTTP errors. */
export class BridgeError extends AppError {
  constructor(statusCode: number, code: string, message: string, options?: { cause?: unknown }) {
    super("BridgeError", statusCode, code, message, options);
  }

  toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "internal", false, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when required configuration is missing. */
export class BridgeConfigError extends BridgeError {
  constructor(message: string) {
    super(0, "CONFIG_ERROR", message);
  }

  override toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "configuration", false, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when the bridge returns a non-OK response. */
export class BridgeHttpError extends BridgeError {
  readonly path: string;
  readonly method: string;
  readonly body: string;

  constructor(httpMethod: string, path: string, statusCode: number, body: string) {
    super(statusCode, "BRIDGE_HTTP_ERROR", `Bridge ${httpMethod} ${path} failed (${statusCode}): ${body}`);
    this.path = path;
    this.method = httpMethod;
    this.body = body;
  }

  override toPluginError(pluginId?: string): PluginError {
    const category: PluginErrorCategory =
      this.statusCode === 403 ? "permission" :
      this.statusCode === 429 ? "network" :
      this.statusCode >= 500 ? "internal" :
      "validation";
    const retryable = this.statusCode === 429 || this.statusCode >= 500;
    return new PluginError(this.code, this.message, category, retryable, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when the bridge returns 404. */
export class BridgeNotFoundError extends BridgeError {
  readonly path: string;

  constructor(path: string) {
    super(404, "NOT_FOUND", `Bridge resource not found: ${path}`);
    this.path = path;
  }

  override toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "validation", false, {
      pluginId,
      causeCode: this.code,
    });
  }
}

/** Thrown when a bridge request times out or network fails. */
export class BridgeNetworkError extends BridgeError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(0, "NETWORK_ERROR", message, options);
  }

  override toPluginError(pluginId?: string): PluginError {
    return new PluginError(this.code, this.message, "network", true, {
      pluginId,
      causeCode: this.code,
    });
  }
}

// Re-export for plugin consumers
export { PluginError };
export type { PluginErrorCategory };
