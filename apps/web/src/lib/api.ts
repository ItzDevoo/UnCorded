import type { ApiError } from '@uncorded/shared';
import { API_BASE } from './config.js';

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
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: 'Request failed',
    }))) as ApiError;
    throw new ApiRequestError(res.status, body);
  }

  return res.json() as Promise<T>;
}
