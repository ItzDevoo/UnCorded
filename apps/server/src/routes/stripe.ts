import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { checkoutRequestSchema, ValidationError, NotFoundError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
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
  .resolve(authResolve())

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
      ui_mode: "embedded",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${env.CORS_ORIGIN ?? env.APP_URL}/home?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      subscription_data: {
        metadata: { userId: sessionUser.id, tier: parsed.data.tier },
      },
      allow_promotion_codes: true,
    });

    return { clientSecret: checkoutSession.client_secret };
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
      throw new NotFoundError("Subscription");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${env.CORS_ORIGIN ?? env.APP_URL}/home`,
    });

    return { portalUrl: portalSession.url };
  })

  // ── GET /api/stripe/subscription ─────────────────────────────────────
  .get("/subscription", async ({ user: sessionUser }) => {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub || !sub.stripeSubscriptionId) {
      return { subscription: null };
    }

    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, {
      expand: ["default_payment_method"],
    });

    let paymentMethod: { brand: string; last4: string } | null = null;
    const pm = stripeSub.default_payment_method;
    if (pm && typeof pm === "object" && "card" in pm && pm.card) {
      paymentMethod = { brand: pm.card.brand, last4: pm.card.last4 };
    }

    return {
      subscription: {
        tier: sub.tier,
        status: sub.status,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        createdAt: sub.createdAt.toISOString(),
        paymentMethod,
      },
    };
  })

  // ── POST /api/stripe/subscription/cancel ─────────────────────────────
  .post("/subscription/cancel", async ({ user: sessionUser }) => {
    const [sub] = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundError("Subscription");
    }

    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return {
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: new Date(updated.items.data[0]!.current_period_end * 1000).toISOString(),
    };
  })

  // ── POST /api/stripe/subscription/resume ─────────────────────────────
  .post("/subscription/resume", async ({ user: sessionUser }) => {
    const [sub] = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundError("Subscription");
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return { cancelAtPeriodEnd: false };
  })

  // ── POST /api/stripe/subscription/change-plan ────────────────────────
  .post("/subscription/change-plan", async ({ user: sessionUser, body }) => {
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const [sub] = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundError("Subscription");
    }

    const stripe = getStripe();
    const newPriceId = getPriceId(parsed.data.tier);
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;

    if (!itemId) {
      throw new NotFoundError("Subscription item");
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    return { tier: parsed.data.tier };
  })

  // ── POST /api/stripe/subscription/setup-intent ───────────────────────
  .post("/subscription/setup-intent", async ({ user: sessionUser }) => {
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      throw new NotFoundError("Subscription");
    }

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.create({
      customer: sub.stripeCustomerId,
      usage: "off_session",
    });

    return { clientSecret: setupIntent.client_secret };
  })

  // ── POST /api/stripe/subscription/update-payment-method ──────────────
  .post("/subscription/update-payment-method", async ({ user: sessionUser, body }) => {
    const parsed = z.object({ paymentMethodId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("paymentMethodId is required");
    }

    const [sub] = await db
      .select({
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, sessionUser.id))
      .limit(1);

    if (!sub?.stripeCustomerId || !sub?.stripeSubscriptionId) {
      throw new NotFoundError("Subscription");
    }

    const stripe = getStripe();

    // Set as default payment method on customer
    await stripe.customers.update(sub.stripeCustomerId, {
      invoice_settings: { default_payment_method: parsed.data.paymentMethodId },
    });

    // Also set on the subscription itself
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      default_payment_method: parsed.data.paymentMethodId,
    });

    return { success: true };
  });
