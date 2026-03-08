import { z } from "zod";

export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateInvite = z.infer<typeof createInviteSchema>;
