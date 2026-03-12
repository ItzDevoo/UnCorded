import { z } from "zod";

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;

export const userStatusSchema = z.enum(["online", "idle", "dnd", "offline"]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(USERNAME_MIN).max(USERNAME_MAX),
  displayName: z.string().max(64).nullable(),
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
    .min(USERNAME_MIN)
    .max(USERNAME_MAX)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  displayName: z.string().max(64).nullable().optional(),
  status: userStatusSchema.optional(),
});

export type UpdateUser = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN),
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export type DeleteAccount = z.infer<typeof deleteAccountSchema>;
