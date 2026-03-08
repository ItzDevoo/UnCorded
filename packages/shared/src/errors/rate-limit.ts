import { AppError } from "./base.js";

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super("RateLimitError", 429, "RATE_LIMITED", message);
  }
}
