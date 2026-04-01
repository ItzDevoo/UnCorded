/**
 * Reusable HTTP client for proxying bridge requests to the UnCorded REST API.
 * Authenticates via the session cookie, same pattern as lifecycle.ts reportTunnelUrl.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export interface ApiClient {
  get(path: string, params?: Record<string, string | undefined>): Promise<Response>;
  post(path: string, body?: unknown): Promise<Response>;
}

export function createApiClient(
  getBaseUrl: () => string | null,
  getToken: () => string | null,
): ApiClient {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const baseUrl = getBaseUrl();
    const token = getToken();

    if (!baseUrl || !token) {
      return new Response(JSON.stringify({ error: "Gateway not connected" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Cookie: `__Secure-uncorded.session_token=${token}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: controller.signal,
      });
      return res;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return new Response(JSON.stringify({ error: "Upstream request timed out" }), {
          status: 504,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Upstream request failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async get(path: string, params?: Record<string, string | undefined>): Promise<Response> {
      const url = new URL(path, "http://placeholder");
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            url.searchParams.set(key, value);
          }
        }
      }
      // Reconstruct path with query string
      const fullPath = `${url.pathname}${url.search}`;
      return request("GET", fullPath);
    },

    async post(path: string, body?: unknown): Promise<Response> {
      return request("POST", path, body);
    },
  };
}
