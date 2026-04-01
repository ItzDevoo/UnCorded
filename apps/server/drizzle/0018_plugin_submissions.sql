CREATE TYPE "public"."plugin_submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "plugin_registry" ADD COLUMN "author_user_id" text;--> statement-breakpoint
CREATE TABLE "plugin_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"status" "plugin_submission_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text
);
--> statement-breakpoint
ALTER TABLE "plugin_registry" ADD CONSTRAINT "plugin_registry_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_submissions" ADD CONSTRAINT "plugin_submissions_plugin_id_plugin_registry_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugin_registry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_submissions" ADD CONSTRAINT "plugin_submissions_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_submissions" ADD CONSTRAINT "plugin_submissions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plugin_submissions_author_idx" ON "plugin_submissions" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "plugin_submissions_status_idx" ON "plugin_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_submissions_pending_unique_idx" ON "plugin_submissions" ("plugin_id") WHERE "status" = 'pending';
