import { z } from "zod";

export const checkoutRequestSchema = z.object({
  tier: z.enum(["supporter", "server_owner"]),
});
