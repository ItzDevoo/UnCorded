import { AppError } from "./base.js";

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UnauthorizedError", 401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super("ForbiddenError", 403, "FORBIDDEN", message);
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = "Session has expired") {
    super("SessionExpiredError", 401, "SESSION_EXPIRED", message);
  }
}
