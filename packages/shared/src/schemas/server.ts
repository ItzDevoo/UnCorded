import { z } from "zod";

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  iconUrl: z.string().url().nullable().optional(),
});

export type CreateServer = z.infer<typeof createServerSchema>;

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

export type UpdateServer = z.infer<typeof updateServerSchema>;

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1),
});

export type TransferOwnership = z.infer<typeof transferOwnershipSchema>;
