import { AppError } from "./base.js";

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super("ValidationError", 400, "VALIDATION_ERROR", message);
  }
}
