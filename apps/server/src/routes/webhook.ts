import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions, user } from "../db/schema.js";
import { getStripe } from "../lib/stripe.js";
import { env } from "../env.js";
import type Stripe from "stripe";

// ── Helpers ──────────────────────────────────────────────────────────────

function mapStripeStatus(status: Stripe.Subscription.Status): "active" | "cancelled" | "past_due" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "cancelled";
  }
}

function tierFromPriceId(priceId: string): "supporter" | "server_owner" | null {
  if (priceId === env.STRIPE_SUPPORTER_PRICE_ID) return "supporter";
  if (priceId === env.STRIPE_SERVER_OWNER_PRICE_ID) return "server_owner";
  return null;
}

// ── Webhook route ────────────────────────────────────────────────────────

export const webhookRoutes = new Elysia().post(
  "/api/webhooks/stripe",
  async ({ request, set }) => {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      set.status = 503;
      return { error: "Webhook secret not configured" };
    }

    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      set.status = 400;
      return { error: "Missing stripe-signature header" };
    }

    // Read raw body for signature verification.
    // This must happen before Elysia parses the body — we use request.text()
    // directly. The route is configured with parse: "text" to prevent Elysia
    // from consuming the body stream before we read it.
    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      set.status = 400;
      return { error: "Invalid signature" };
    }

    // ── Event dispatch ─────────────────────────────────────────────────

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  },
  {
    // Prevent Elysia from auto-parsing the JSON body — we need the raw
    // string for Stripe signature verification via constructEvent().
    parse: "text",
  },
);

// ── Event handlers ───────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as "supporter" | "server_owner" | undefined;

  if (!userId || !tier) return;

  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!stripeSubscriptionId || !stripeCustomerId) return;

  // Retrieve full subscription for period info
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const periodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  // Upsert subscription record
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        tier,
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
        currentPeriodEnd,
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      userId,
      tier,
      stripeSubscriptionId,
      stripeCustomerId,
      status: "active",
      currentPeriodEnd,
    });
  }

  // Update user tier
  await db.update(user).set({ subscriptionTier: tier }).where(eq(user.id, userId));
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const [existing] = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (!existing) return;

  const status = mapStripeStatus(sub.status);
  const priceId = sub.items.data[0]?.price.id;
  const tier = priceId ? tierFromPriceId(priceId) : null;
  const periodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  const updateData: Record<string, unknown> = {
    status,
    currentPeriodEnd,
  };
  if (tier) {
    updateData.tier = tier;
  }

  await db.update(subscriptions).set(updateData).where(eq(subscriptions.id, existing.id));

  // Update user tier — active stays on current tier, cancelled/past_due reverts to free
  const userTier = status === "active" && tier ? tier : "free";
  await db.update(user).set({ subscriptionTier: userTier }).where(eq(user.id, existing.userId));
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const [existing] = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (!existing) return;

  await db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(eq(subscriptions.id, existing.id));

  await db.update(user).set({ subscriptionTier: "free" }).where(eq(user.id, existing.userId));
}
