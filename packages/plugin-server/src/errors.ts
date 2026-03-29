import { AppError } from "@uncorded/shared";

/** Base error for all bridge HTTP errors. */
export class BridgeError extends AppError {
  constructor(statusCode: number, code: string, message: string, options?: { cause?: unknown }) {
    super("BridgeError", statusCode, code, message, options);
  }
}

/** Thrown when required configuration is missing. */
export class BridgeConfigError extends BridgeError {
  constructor(message: string) {
    super(0, "CONFIG_ERROR", message);
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
}

/** Thrown when the bridge returns 404. */
export class BridgeNotFoundError extends BridgeError {
  readonly path: string;

  constructor(path: string) {
    super(404, "NOT_FOUND", `Bridge resource not found: ${path}`);
    this.path = path;
  }
}

/** Thrown when a bridge request times out or network fails. */
export class BridgeNetworkError extends BridgeError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(0, "NETWORK_ERROR", message, options);
  }
}
