/** Base error for all plugin bridge errors. */
export class BridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

/** Thrown when a bridge request times out. */
export class RequestTimeoutError extends BridgeError {
  readonly method: string;
  readonly requestId: string;

  constructor(method: string, requestId: string, timeoutMs: number) {
    super("REQUEST_TIMEOUT", `Request "${method}" (${requestId}) timed out after ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
    this.method = method;
    this.requestId = requestId;
  }
}

/** Thrown when the plugin is destroyed while requests are pending. */
export class PluginDestroyedError extends BridgeError {
  constructor() {
    super("PLUGIN_DESTROYED", "Plugin was destroyed while requests were pending");
    this.name = "PluginDestroyedError";
  }
}
