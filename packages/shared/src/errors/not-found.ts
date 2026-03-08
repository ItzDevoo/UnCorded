import { AppError } from "./base.js";

export class NotFoundError extends AppError {
  constructor(resource = "Resource", options?: { cause?: unknown }) {
    super("NotFoundError", 404, "NOT_FOUND", `${resource} not found`, options);
  }
}
