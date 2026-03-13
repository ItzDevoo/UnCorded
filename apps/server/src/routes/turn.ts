import { Elysia } from "elysia";
import { ForbiddenError } from "@uncorded/shared";
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
  .get("/credentials", async ({ user, set }) => {
    if (user.subscriptionTier === "free") {
      throw new ForbiddenError("TURN relay requires a paid subscription");
    }

    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
      set.status = 503;
      return { code: "SERVICE_UNAVAILABLE", message: "TURN server not configured" };
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
        set.status = 502;
        return {
          code: "BAD_GATEWAY",
          message: "Failed to fetch TURN credentials from Cloudflare",
        };
      }

      const data = (await res.json()) as CloudflareIceServers;

      return { iceServers: data.iceServers };
    } catch {
      set.status = 502;
      return {
        code: "BAD_GATEWAY",
        message: "Failed to fetch TURN credentials from Cloudflare",
      };
    } finally {
      clearTimeout(timer);
    }
  });
