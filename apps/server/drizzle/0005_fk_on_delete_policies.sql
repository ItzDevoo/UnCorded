-- Make columns nullable for SET NULL FK policies
ALTER TABLE "messages" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "file_receipts" ALTER COLUMN "sender_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "creator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "reporter_id" DROP NOT NULL;--> statement-breakpoint

-- subscriptions: add ON DELETE CASCADE
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- messages: add ON DELETE SET NULL
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_author_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- file_receipts: add ON DELETE SET NULL
ALTER TABLE "file_receipts" DROP CONSTRAINT IF EXISTS "file_receipts_sender_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "file_receipts" ADD CONSTRAINT "file_receipts_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- invites: add ON DELETE SET NULL
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_creator_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- reports: add ON DELETE SET NULL
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_reporter_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
