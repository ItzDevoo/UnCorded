import { AppError } from "./base.js";

export class ConflictError extends AppError {
  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super("ConflictError", 409, code, message, options);
  }
}
