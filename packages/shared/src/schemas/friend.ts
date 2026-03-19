import { z } from "zod";
import { USERNAME_MAX } from "./user.js";

export const friendRequestSchema = z.object({ username: z.string().min(1).max(USERNAME_MAX) });

export const friendRequestResponseSchema = z.object({
  status: z.enum(["pending", "accepted"]),
  user: z
    .object({
      userId: z.string(),
      username: z.string().nullable(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      status: z.string(),
    })
    .optional(),
  dmChannelId: z.string().optional(),
});
