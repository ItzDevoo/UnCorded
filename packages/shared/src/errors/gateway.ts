import { AppError } from "./base.js";

export class BadGatewayError extends AppError {
  constructor(message = "Bad gateway", options?: { cause?: unknown }) {
    super("BadGatewayError", 502, "BAD_GATEWAY", message, options);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", options?: { cause?: unknown }) {
    super("ServiceUnavailableError", 503, "SERVICE_UNAVAILABLE", message, options);
  }
}
