import { AppError } from "./base.js";

export class InternalError extends AppError {
  constructor(message = "Internal server error", options?: { cause?: unknown }) {
    super("InternalError", 500, "INTERNAL_ERROR", message, options);
  }
}
