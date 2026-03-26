-- Add receiver_id for DM P2P share sessions (sender→receiver without a channel)
ALTER TABLE "file_receipts" ADD COLUMN "receiver_id" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint

-- Make channel_id nullable (DM shares don't have a channel)
ALTER TABLE "file_receipts" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint

-- Make magnet_uri and info_hash nullable (receipt history doesn't need them long-term)
ALTER TABLE "file_receipts" ALTER COLUMN "magnet_uri" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "file_receipts" ALTER COLUMN "info_hash" DROP NOT NULL;--> statement-breakpoint

-- Drop the unique constraint on message_id (DM shares don't create messages)
ALTER TABLE "file_receipts" DROP CONSTRAINT IF EXISTS "uq_file_receipts_message_id";--> statement-breakpoint

-- Add indexes for receipt queries by sender/receiver
CREATE INDEX "idx_file_receipts_sender_id" ON "file_receipts" ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_file_receipts_receiver_id" ON "file_receipts" ("receiver_id");
