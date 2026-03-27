-- Add is_bot flag to user table
ALTER TABLE "user" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Create bots table
CREATE TABLE "bots" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "token_hash" text NOT NULL,
  "token_prefix" text NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "bots_user_id_unique" UNIQUE("user_id")
);--> statement-breakpoint

CREATE INDEX "bots_owner_id_idx" ON "bots" ("owner_id");
