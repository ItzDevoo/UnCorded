import { z } from "zod";

export const channelTypeSchema = z.enum(["text", "category"]);

export type ChannelType = z.infer<typeof channelTypeSchema>;

export const createChannelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: channelTypeSchema.optional(),
  fileSharingEnabled: z.boolean().optional(),
  topic: z.string().max(1024).optional(),
});

export type CreateChannel = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  topic: z.string().max(1024).nullable().optional(),
  fileSharingEnabled: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateChannel = z.infer<typeof updateChannelSchema>;
