import { Elysia } from "elysia";
import { ForbiddenError, ServiceUnavailableError, BadGatewayError } from "@uncorded/shared";
import { authResolve } from "../middleware/auth.js";
import { env } from "../env.js";

const TURN_TTL = 86_400; // 24 hours

interface CloudflareIceServers {
  iceServers: {
    urls: string[];
    username?: string;
    credential?: string;
  }[];
}

export const turnRoutes = new Elysia({ prefix: "/api/turn" })
  .resolve(authResolve())

  // ── GET /api/turn/credentials ──────────────────────────────────────
  .get("/credentials", async ({ user }) => {
    if (user.subscriptionTier === "free") {
      throw new ForbiddenError("TURN relay requires a paid subscription");
    }

    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
      throw new ServiceUnavailableError("TURN server not configured");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: TURN_TTL }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        throw new BadGatewayError("Failed to fetch TURN credentials from Cloudflare");
      }

      const data = (await res.json()) as CloudflareIceServers;

      return { iceServers: data.iceServers };
    } catch (err) {
      if (err instanceof BadGatewayError) throw err;
      throw new BadGatewayError("Failed to fetch TURN credentials from Cloudflare", { cause: err });
    } finally {
      clearTimeout(timer);
    }
  });
