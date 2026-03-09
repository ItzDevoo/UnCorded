ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_message_id_messages_id_fk";--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_file_receipt_id_file_receipts_id_fk";--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_file_receipt_id_file_receipts_id_fk" FOREIGN KEY ("file_receipt_id") REFERENCES "public"."file_receipts"("id") ON DELETE set null ON UPDATE no action;
