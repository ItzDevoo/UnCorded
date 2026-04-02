import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions, giftedSubscriptions } from "../db/schema.js";

type Tier = "free" | "supporter" | "server_owner";

const TIER_RANK: Record<Tier, number> = {
  free: 0,
  supporter: 1,
  server_owner: 2,
};

function higherTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/**
 * Compute the effective subscription tier for a user by checking both
 * Stripe subscriptions and admin-gifted subscriptions.
 * Returns the higher of the two (paid wins over gifted, gifted wins over free).
 */
export async function computeEffectiveTier(userId: string): Promise<Tier> {
  const now = new Date();

  const [[stripeSub], [gift]] = await Promise.all([
    db
      .select({ tier: subscriptions.tier, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
    db
      .select({
        id: giftedSubscriptions.id,
        tier: giftedSubscriptions.tier,
        expiresAt: giftedSubscriptions.expiresAt,
      })
      .from(giftedSubscriptions)
      .where(eq(giftedSubscriptions.userId, userId))
      .limit(1),
  ]);

  // Determine Stripe tier
  const stripeTier: Tier = stripeSub?.status === "active" ? (stripeSub.tier as Tier) : "free";

  // Determine gifted tier (clean up expired gifts)
  let giftedTier: Tier = "free";
  if (gift) {
    if (gift.expiresAt > now) {
      giftedTier = gift.tier as Tier;
    } else {
      // Gift expired — clean it up
      await db.delete(giftedSubscriptions).where(eq(giftedSubscriptions.id, gift.id));
    }
  }

  return higherTier(stripeTier, giftedTier);
}
