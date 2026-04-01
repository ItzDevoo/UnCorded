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

/** Type-safe API call with runtime Zod validation. */
export async function apiValidated<T>(
  path: string,
  schema: import("zod").ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const raw = await api<unknown>(path, options);
  return schema.parse(raw);
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
  const res = await api<{ clientSecret: string }>("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
  return res.clientSecret;
}

export async function createPortalSession(): Promise<string> {
  const res = await api<{ portalUrl: string }>("/api/stripe/customer-portal", {
    method: "POST",
  });
  return res.portalUrl;
}

// ── Subscription management ──────────────────────────────────────────────

export interface SubscriptionDetails {
  tier: "supporter" | "server_owner";
  status: "active" | "cancelled" | "past_due";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  paymentMethod: { brand: string; last4: string } | null;
}

export interface GiftDetails {
  tier: "supporter" | "server_owner";
  expiresAt: string;
}

export interface SubscriptionResponse {
  subscription: SubscriptionDetails | null;
  gift: GiftDetails | null;
}

export async function getSubscription(): Promise<SubscriptionResponse> {
  return api<SubscriptionResponse>("/api/stripe/subscription");
}

export async function cancelSubscription(): Promise<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: string }> {
  return api("/api/stripe/subscription/cancel", { method: "POST" });
}

export async function resumeSubscription(): Promise<{ cancelAtPeriodEnd: boolean }> {
  return api("/api/stripe/subscription/resume", { method: "POST" });
}

export async function changePlan(tier: "supporter" | "server_owner"): Promise<{ tier: string }> {
  return api("/api/stripe/subscription/change-plan", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
}

export async function createSetupIntent(): Promise<string> {
  const res = await api<{ clientSecret: string }>("/api/stripe/subscription/setup-intent", {
    method: "POST",
  });
  return res.clientSecret;
}

export async function updatePaymentMethod(paymentMethodId: string): Promise<void> {
  await api("/api/stripe/subscription/update-payment-method", {
    method: "POST",
    body: JSON.stringify({ paymentMethodId }),
  });
}
