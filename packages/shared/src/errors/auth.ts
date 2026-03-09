import { AppError } from "./base.js";

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", options?: { cause?: unknown }) {
    super("UnauthorizedError", 401, "UNAUTHORIZED", message, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions", options?: { cause?: unknown }) {
    super("ForbiddenError", 403, "FORBIDDEN", message, options);
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = "Session has expired", options?: { cause?: unknown }) {
    super("SessionExpiredError", 401, "SESSION_EXPIRED", message, options);
  }
}
