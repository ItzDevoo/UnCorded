-- Gifted subscriptions table
CREATE TABLE IF NOT EXISTS "gifted_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "tier" "subscription_tier" NOT NULL,
  "gifted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reason" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_gifted_subscriptions_expires_at" ON "gifted_subscriptions" ("expires_at");
