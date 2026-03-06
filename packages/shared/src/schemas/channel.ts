import { z } from 'zod';

export const channelTypeSchema = z.enum(['text', 'category']);

export type ChannelType = z.infer<typeof channelTypeSchema>;

export const storagePolicySchema = z.enum(['ephemeral', 'extended', 'persistent']);

export type StoragePolicy = z.infer<typeof storagePolicySchema>;

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: channelTypeSchema.optional(),
  storagePolicy: storagePolicySchema.optional(),
  topic: z.string().max(1024).optional(),
});

export type CreateChannel = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).nullable().optional(),
  storagePolicy: storagePolicySchema.optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateChannel = z.infer<typeof updateChannelSchema>;
