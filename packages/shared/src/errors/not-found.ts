import { AppError } from "./base.js";

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NotFoundError", 404, "NOT_FOUND", `${resource} not found`);
  }
}
