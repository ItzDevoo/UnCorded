-- Admin + Feedback tables migration

-- Enums
DO $$ BEGIN
  CREATE TYPE "admin_level" AS ENUM ('admin', 'owner');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "feedback_type" AS ENUM ('feature', 'bug');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "feedback_status" AS ENUM ('open', 'in_progress', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add banned column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;

-- Admins table (separate from users for security isolation)
CREATE TABLE IF NOT EXISTS "admins" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "level" "admin_level" NOT NULL,
  "added_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "added_at" timestamp DEFAULT now() NOT NULL
);

-- Feedback table
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" "feedback_type" NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "status" "feedback_status" DEFAULT 'open' NOT NULL,
  "vote_count" integer DEFAULT 0 NOT NULL,
  "admin_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Feedback votes (one per user per feedback item)
CREATE TABLE IF NOT EXISTS "feedback_votes" (
  "id" text PRIMARY KEY NOT NULL,
  "feedback_id" text NOT NULL REFERENCES "feedback"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_vote_unique" UNIQUE("feedback_id", "user_id")
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "admin_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "details" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_created_idx" ON "admin_audit_log" ("created_at" DESC);

-- Owner seeding is done via application bootstrap, not migrations
