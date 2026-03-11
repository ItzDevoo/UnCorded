CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_stripe_sub_id" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dm_members_user_id" ON "dm_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_receipts_channel_id" ON "file_receipts" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invites_server_id" ON "invites" USING btree ("server_id");
