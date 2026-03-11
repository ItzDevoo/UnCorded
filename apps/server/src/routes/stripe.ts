import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { checkoutRequestSchema, ValidationError, NotFoundError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { getStripe } from "../lib/stripe.js";
import { env } from "../env.js";

const PRICE_IDS: Record<string, string | undefined> = {
  supporter: undefined,
  server_owner: undefined,
};

function getPriceId(tier: "supporter" | "server_owner"): string {
  // Lazy-read from env so tests can override
  PRICE_IDS.supporter ??= env.STRIPE_SUPPORTER_PRICE_ID;
  PRICE_IDS.server_owner ??= env.STRIPE_SERVER_OWNER_PRICE_ID;

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    throw new ValidationError(`${tier} tier is not configured`);
  }
  return priceId;
}

export const stripeRoutes = new Elysia({ prefix: "/api/stripe" })
  .resolve(async ({ status, request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      return status(401, { code: "UNAUTHORIZED", message: "Authentication required" });
    }
    return {
      user: session.user,
      session: session.session,
    };
  })

  // ── POST /api/stripe/checkout ────────────────────────────────────────
  .post("/checkout", async ({ user: sessionUser, body }) => {
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const stripe = getStripe();
    const priceId = getPriceId(parsed.data.tier);

    // Find existing Stripe customer from subscriptions table
    const [existing] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    let customerId = existing?.stripeCustomerId;

    // Create Stripe customer if none exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: sessionUser.email,
        metadata: { userId: sessionUser.id },
      });
      customerId = customer.id;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.CORS_ORIGIN ?? env.APP_URL}/home?checkout=success`,
      cancel_url: `${env.CORS_ORIGIN ?? env.APP_URL}/home?checkout=cancelled`,
      subscription_data: {
        metadata: { userId: sessionUser.id, tier: parsed.data.tier },
      },
      allow_promotion_codes: true,
    });

    return { checkoutUrl: checkoutSession.url };
  })

  // ── POST /api/stripe/customer-portal ─────────────────────────────────
  .post("/customer-portal", async ({ user: sessionUser }) => {
    const stripe = getStripe();

    const [existing] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!existing?.stripeCustomerId) {
      throw new NotFoundError("No active subscription");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${env.CORS_ORIGIN ?? env.APP_URL}/home`,
    });

    return { portalUrl: portalSession.url };
  });
