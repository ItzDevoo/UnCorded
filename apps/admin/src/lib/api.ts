import type { ApiError } from "@uncorded/shared";
import type { ZodType } from "zod";
import { API_BASE } from "./config.js";

export class ApiRequestError extends Error {
  status: number;
  body: ApiError;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

function normalizeHeaders(raw: HeadersInit | undefined): Record<string, string> {
  if (!raw) return {};
  if (raw instanceof Headers) return Object.fromEntries(raw.entries());
  if (Array.isArray(raw)) return Object.fromEntries(raw);
  return { ...raw };
}

export async function api<T>(path: string, options?: RequestInit, schema?: ZodType<T>): Promise<T> {
  const opts = options ?? {};
  const headers: Record<string, string> = normalizeHeaders(opts.headers);

  // Only set Content-Type for JSON when there's a body that isn't FormData/Blob
  if (opts.body && !(opts.body instanceof FormData) && !(opts.body instanceof Blob)) {
    headers["Content-Type"] ??= "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => null);
    const body: ApiError =
      raw !== null && typeof raw === "object" && "code" in raw && "message" in raw
        ? (raw as ApiError)
        : { code: "UNKNOWN", message: "Request failed" };
    throw new ApiRequestError(res.status, body);
  }

  // 204 No Content — return undefined cast as T since there is no response body
  if (res.status === 204) return undefined as T;

  const json: unknown = await res.json();

  if (schema) {
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new ApiRequestError(res.status, {
        code: "VALIDATION_ERROR",
        message: `Response validation failed: ${result.error.message}`,
      });
    }
    return result.data;
  }

  return json as T;
}
