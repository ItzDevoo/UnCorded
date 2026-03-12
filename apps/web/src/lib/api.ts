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

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: "PATCH" | "POST" | "PUT" = "PATCH",
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    body: formData,
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
  return res.json() as Promise<T>;
}

export async function createCheckout(tier: "supporter" | "server_owner"): Promise<string> {
  const res = await api<{ checkoutUrl: string }>("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
  return res.checkoutUrl;
}

export async function createPortalSession(): Promise<string> {
  const res = await api<{ portalUrl: string }>("/api/stripe/customer-portal", {
    method: "POST",
  });
  return res.portalUrl;
}
