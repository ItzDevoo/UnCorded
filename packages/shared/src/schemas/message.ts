import { z } from "zod";

export const createMessageSchema = z.object({
  content: z.string().max(4000).optional(),
});

export type CreateMessage = z.infer<typeof createMessageSchema>;

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export type UpdateMessage = z.infer<typeof updateMessageSchema>;
