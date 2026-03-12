import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import {
  updateUserSchema,
  changePasswordSchema,
  deleteAccountSchema,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_TYPES,
} from "@uncorded/shared";
import { userId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { user, servers } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { auth } from "../auth/index.js";
import { isR2Configured, uploadAvatar, deleteAvatar } from "../lib/r2.js";
import { AppError } from "@uncorded/shared";

function serializeUser(dbUser: typeof user.$inferSelect) {
  return {
    id: userId(dbUser.id),
    username: dbUser.username,
    displayName: dbUser.displayName,
    email: dbUser.email,
    avatarUrl: dbUser.avatarUrl,
    status: dbUser.status,
    subscriptionTier: dbUser.subscriptionTier,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  };
}

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .resolve(authResolve())
  .get("/@me", async ({ user: sessionUser }) => {
    const [dbUser] = await db.select().from(user).where(eq(user.id, sessionUser.id)).limit(1);

    if (!dbUser) {
      throw new NotFoundError("User");
    }

    return serializeUser(dbUser);
  })
  .patch("/@me", async ({ user: sessionUser, body }) => {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const updates: Partial<typeof user.$inferInsert> = {};

    if (parsed.data.username !== undefined) {
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, parsed.data.username))
        .limit(1);

      if (existing && existing.id !== sessionUser.id) {
        throw new ConflictError("USERNAME_TAKEN", "Username is already taken");
      }

      updates.username = parsed.data.username;
      updates.displayUsername = parsed.data.username;
    }

    if (parsed.data.displayName !== undefined) {
      updates.displayName = parsed.data.displayName;
    }

    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No fields to update");
    }

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, sessionUser.id))
      .returning();

    if (!updated) {
      throw new NotFoundError("User");
    }

    return serializeUser(updated);
  })
  .patch("/@me/avatar", async ({ user: sessionUser, request }) => {
    if (!isR2Configured()) {
      throw new AppError(
        "AvatarUploadDisabled",
        501,
        "AVATAR_UPLOAD_DISABLED",
        "Avatar upload is not configured",
      );
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!file || !(file instanceof File)) {
      throw new ValidationError("No avatar file provided");
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      throw new ValidationError("Invalid file type. Allowed: PNG, JPEG, GIF, WebP");
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new ValidationError("File too large. Maximum size is 4 MB");
    }

    const [current] = await db
      .select({ avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    // Upload new avatar first — don't delete old until DB is updated
    const buffer = await file.arrayBuffer();
    const avatarUrl = await uploadAvatar(sessionUser.id, buffer, file.type);

    const [updated] = await db
      .update(user)
      .set({ avatarUrl })
      .where(eq(user.id, sessionUser.id))
      .returning();

    if (!updated) {
      throw new NotFoundError("User");
    }

    // Clean up old avatar only after successful upload + DB update
    if (current?.avatarUrl) {
      deleteAvatar(current.avatarUrl).catch((err) =>
        console.error("[r2] old avatar cleanup failed:", err),
      );
    }

    return serializeUser(updated);
  })
  .delete("/@me/avatar", async ({ user: sessionUser }) => {
    const [current] = await db
      .select({ avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    // Update DB first — if this fails, the R2 object stays (safe)
    const [updated] = await db
      .update(user)
      .set({ avatarUrl: null })
      .where(eq(user.id, sessionUser.id))
      .returning();

    if (!updated) {
      throw new NotFoundError("User");
    }

    // Clean up R2 object only after successful DB update (fire-and-forget)
    if (current?.avatarUrl && isR2Configured()) {
      deleteAvatar(current.avatarUrl).catch((err) =>
        console.error("[r2] avatar cleanup failed:", err),
      );
    }

    return serializeUser(updated);
  })
  .post("/@me/password", async ({ body, request }) => {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    try {
      await auth.api.changePassword({
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
        },
        headers: request.headers,
      });
    } catch (err) {
      const code = err instanceof Error && "code" in err ? (err as { code: string }).code : null;
      if (code === "INVALID_PASSWORD") {
        throw new UnauthorizedError("Current password is incorrect");
      }
      if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
        throw new ValidationError("New password does not meet requirements");
      }
      if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
        throw new ValidationError("No password set — account uses OAuth only");
      }
      throw err;
    }

    return { success: true };
  })
  .delete("/@me", async ({ user: sessionUser, body, request }) => {
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const [dbUser] = await db
      .select({ avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    if (!dbUser) {
      throw new NotFoundError("User");
    }

    // Verify password without creating a session
    try {
      const result = await auth.api.verifyPassword({
        body: { password: parsed.data.password },
        headers: request.headers,
      });
      if (!result.status) {
        throw new UnauthorizedError("Incorrect password");
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      const code = err instanceof Error && "code" in err ? (err as { code: string }).code : null;
      if (code === "INVALID_PASSWORD") {
        throw new UnauthorizedError("Incorrect password");
      }
      if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
        throw new ValidationError("No password set — account uses OAuth only");
      }
      throw new UnauthorizedError("Incorrect password");
    }

    // Check server ownership — servers have onDelete: "restrict"
    const [ownedServer] = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.ownerId, sessionUser.id))
      .limit(1);

    if (ownedServer) {
      throw new AppError(
        "ServerOwnerError",
        409,
        "SERVER_OWNER",
        "You must transfer or delete all servers you own before deleting your account",
      );
    }

    // Delete user first (cascades: sessions, accounts, memberships, dm_members, messages set null)
    await db.delete(user).where(eq(user.id, sessionUser.id));

    // Clean up avatar from R2 after successful DB delete (fire-and-forget)
    if (dbUser.avatarUrl && isR2Configured()) {
      deleteAvatar(dbUser.avatarUrl).catch((err) =>
        console.error("[r2] avatar cleanup on account delete failed:", err),
      );
    }

    return { success: true };
  });
