import type { ApiError } from "@uncorded/shared";
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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => null);
    const body: ApiError =
      raw !== null && typeof raw === "object" && "code" in raw && "message" in raw
        ? (raw as ApiError)
        : { code: "UNKNOWN", message: "Request failed" };
    throw new ApiRequestError(res.status, body);
  }

  if (res.status === 204) return undefined as T;

  // TODO: validate API responses with Zod at call sites
  return res.json() as Promise<T>;
}
