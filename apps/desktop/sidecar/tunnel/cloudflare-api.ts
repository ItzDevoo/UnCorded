import { randomBytes } from "node:crypto";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const REQUEST_TIMEOUT_MS = 15_000;

export interface CloudflareTunnel {
  id: string;
  name: string;
  status: string;
}

export class CloudflareApi {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${CF_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        success: boolean;
        result: T;
        errors?: Array<{ message: string }>;
      };
      if (!data.success) {
        const msg = data.errors?.[0]?.message ?? `HTTP ${res.status}`;
        throw new Error(`Cloudflare API error: ${msg}`);
      }
      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", `/accounts/${this.accountId}/cfd_tunnel?per_page=1`);
      return true;
    } catch {
      return false;
    }
  }

  async createTunnel(name: string): Promise<CloudflareTunnel> {
    const tunnelSecret = randomBytes(32).toString("base64");

    return this.request<CloudflareTunnel>("POST", `/accounts/${this.accountId}/cfd_tunnel`, {
      name,
      tunnel_secret: tunnelSecret,
    });
  }

  async deleteTunnel(tunnelId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}?cleanup_connections=true`,
    );
  }

  async getTunnelToken(tunnelId: string): Promise<string> {
    return this.request<string>("GET", `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/token`);
  }

  async listTunnels(name?: string): Promise<CloudflareTunnel[]> {
    const params = new URLSearchParams({ is_deleted: "false", per_page: "100" });
    if (name) params.set("name", name);
    return this.request<CloudflareTunnel[]>(
      "GET",
      `/accounts/${this.accountId}/cfd_tunnel?${params}`,
    );
  }
}
