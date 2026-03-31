import { Elysia } from "elysia";
import { z } from "zod";
import { RATE_LIMIT_MESSAGE_CREATE } from "@uncorded/shared";
import { validateInput } from "../helpers/validation.js";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { env } from "../env.js";

const checkHashSchema = z.object({
  hash: z.string().min(1, "hash must be a non-empty string"),
});

export const safetyRoutes = new Elysia({ prefix: "/api/safety" })
  .resolve(authResolve())
  .post("/check-hash", async ({ user: sessionUser, body }) => {
    await checkUserRateLimit(
      sessionUser.id,
      RL.SAFETY_CHECK_HASH,
      RATE_LIMIT_MESSAGE_CREATE.limit,
      RATE_LIMIT_MESSAGE_CREATE.windowMs,
    );
    const { hash } = validateInput(checkHashSchema, body);

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
