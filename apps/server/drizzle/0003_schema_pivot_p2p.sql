-- Schema pivot: R2 ephemeral storage → P2P WebTorrent

-- Create new enums
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'supporter', 'server_owner');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due');--> statement-breakpoint

-- Drop old tables
DROP TABLE IF EXISTS "attachments";--> statement-breakpoint
DROP TABLE IF EXISTS "purchases";--> statement-breakpoint

-- Drop old enums
DROP TYPE IF EXISTS "public"."storage_policy";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."purchase_item";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."purchase_status";--> statement-breakpoint

-- Users: replace has_extended_expiry + has_custom_avatar with subscription_tier
ALTER TABLE "user" ADD COLUMN "subscription_tier" "public"."subscription_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "has_extended_expiry";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "has_custom_avatar";--> statement-breakpoint

-- Channels: replace storage_policy with file_sharing_enabled
ALTER TABLE "channels" ADD COLUMN "file_sharing_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN IF EXISTS "storage_policy";--> statement-breakpoint

-- Reports: replace attachment_id FK with file_receipt_id FK
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_attachment_id_attachments_id_fk";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "file_receipt_id" text;--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN IF EXISTS "attachment_id";--> statement-breakpoint

-- Create file_receipts table
CREATE TABLE IF NOT EXISTS "file_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"magnet_uri" text NOT NULL,
	"info_hash" text NOT NULL,
	"message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" "public"."subscription_tier" NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"status" "public"."subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add foreign keys
ALTER TABLE "file_receipts" ADD CONSTRAINT "file_receipts_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_receipts" ADD CONSTRAINT "file_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_file_receipt_id_file_receipts_id_fk" FOREIGN KEY ("file_receipt_id") REFERENCES "public"."file_receipts"("id") ON DELETE no action ON UPDATE no action;
