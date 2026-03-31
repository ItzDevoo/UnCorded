import { Elysia } from "elysia";
import { ValidationError, RATE_LIMIT_MESSAGE_CREATE } from "@uncorded/shared";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { env } from "../env.js";

export const safetyRoutes = new Elysia({ prefix: "/api/safety" })
  .resolve(authResolve())
  .post("/check-hash", async ({ user: sessionUser, body }) => {
    await checkUserRateLimit(
      sessionUser.id,
      RL.SAFETY_CHECK_HASH,
      RATE_LIMIT_MESSAGE_CREATE.limit,
      RATE_LIMIT_MESSAGE_CREATE.windowMs,
    );
    const parsed =
      typeof body === "object" && body !== null && "hash" in body
        ? (body as { hash: unknown })
        : null;

    if (!parsed || typeof parsed.hash !== "string" || parsed.hash.length === 0) {
      throw new ValidationError("hash must be a non-empty string");
    }

    const hash = parsed.hash;

    if (env.THORN_API_KEY) {
      // TODO: Integrate with Thorn Safer API
      // POST hash to Thorn for CSAM matching
      // If match found, return { blocked: true } and queue NCMEC report
      if (import.meta.env.DEV) {
        console.log("[safety] Would check hash against Thorn API:", hash.slice(0, 16) + "...");
      }
    }

    console.warn("[safety] Content moderation not configured — bypassing check");
    return { blocked: false, checked: false, reason: "content_moderation_not_configured" };
  });
