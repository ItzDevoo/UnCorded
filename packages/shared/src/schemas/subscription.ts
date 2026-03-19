import { z } from "zod";

export const paidTierSchema = z.enum(["supporter", "server_owner"]);
export type PaidTier = z.infer<typeof paidTierSchema>;

export const checkoutRequestSchema = z.object({
  tier: paidTierSchema,
});
