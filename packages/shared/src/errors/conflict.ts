import { AppError } from "./base.js";

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super("ConflictError", 409, code, message);
  }
}
