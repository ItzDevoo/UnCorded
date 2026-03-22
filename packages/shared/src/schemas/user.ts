import { z } from "zod";

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 32;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
export const DISPLAY_NAME_MAX = 64;
export const PASSWORD_MIN = 8;

export const userStatusSchema = z.enum(["online", "idle", "dnd", "offline"]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string().trim().min(USERNAME_MIN).max(USERNAME_MAX),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX).nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  status: userStatusSchema,
  subscriptionTier: z.enum(["free", "supporter", "server_owner"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

export const updateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN)
    .max(USERNAME_MAX)
    .regex(USERNAME_REGEX, "Username can only contain letters, numbers, underscores, and periods")
    .optional(),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX).nullable().optional(),
  status: userStatusSchema.optional(),
});

export type UpdateUser = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(PASSWORD_MIN).max(128),
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

export type DeleteAccount = z.infer<typeof deleteAccountSchema>;
