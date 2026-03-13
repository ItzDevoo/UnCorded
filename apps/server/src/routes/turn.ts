import { createHmac } from "crypto";
import { Elysia } from "elysia";
import { ForbiddenError } from "@uncorded/shared";
import { authResolve } from "../middleware/auth.js";
import { env } from "../env.js";

const TURN_TTL = 86_400; // 24 hours

export const turnRoutes = new Elysia({ prefix: "/api/turn" })
  .resolve(authResolve())

  // ── GET /api/turn/credentials ──────────────────────────────────────
  .get("/credentials", ({ user, set }) => {
    if (user.subscriptionTier === "free") {
      throw new ForbiddenError("TURN relay requires a paid subscription");
    }

    if (!env.TURN_SERVER_URL || !env.TURN_SHARED_SECRET) {
      set.status = 503;
      return { code: "SERVICE_UNAVAILABLE", message: "TURN server not configured" };
    }

    const expiry = Math.floor(Date.now() / 1000) + TURN_TTL;
    const username = `${expiry}:${user.id}`;
    const credential = createHmac("sha1", env.TURN_SHARED_SECRET)
      .update(username)
      .digest("base64");

    return {
      urls: [env.TURN_SERVER_URL],
      username,
      credential,
      ttl: TURN_TTL,
    };
  });
