import type { ZodSchema } from "zod";
import { ValidationError } from "@uncorded/shared";

export function validateInput<T>(schema: ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return parsed.data;
}
