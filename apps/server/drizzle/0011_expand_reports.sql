CREATE TYPE "public"."report_type" AS ENUM('message', 'file', 'player', 'server');--> statement-breakpoint

ALTER TABLE "reports" ADD COLUMN "target_user_id" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "server_id" text;--> statement-breakpoint

-- Backfill type from existing data before adding NOT NULL constraint
ALTER TABLE "reports" ADD COLUMN "type" "report_type";--> statement-breakpoint
UPDATE "reports" SET "type" = CASE WHEN "message_id" IS NOT NULL THEN 'message' ELSE 'file' END;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint

-- Add foreign keys
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;
