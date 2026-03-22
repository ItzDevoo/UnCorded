import { Elysia } from "elysia";
import { eq, ilike, ne, and, or } from "drizzle-orm";
import { z } from "zod";
import {
  updateUserSchema,
  changePasswordSchema,
  deleteAccountSchema,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  RateLimitError,
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_TYPES,
  RATE_LIMIT_USER_SEARCH,
} from "@uncorded/shared";
import { userId, Opcode } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { user, servers } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { auth } from "../auth/index.js";
import { isR2Configured, uploadAvatar, deleteAvatar } from "../lib/r2.js";
import { AppError } from "@uncorded/shared";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { sendToUser, disconnectUser } from "../ws/connections.js";

// ── Pending deletion state (in-memory, single-server) ──────────
interface PendingDeletion {
  timer: ReturnType<typeof setTimeout>;
  avatarUrl: string | null;
}

const pendingDeletions = new Map<string, PendingDeletion>();

function executeDeletion(targetUserId: string, avatarUrl: string | null) {
  pendingDeletions.delete(targetUserId);
  db.delete(user)
    .where(eq(user.id, targetUserId))
    .then(() => {
      disconnectUser(targetUserId);
      if (avatarUrl && isR2Configured()) {
        deleteAvatar(avatarUrl).catch((err) =>
          console.error("[r2] avatar cleanup on account delete failed:", err),
        );
      }
    })
    .catch((err) => {
      console.error("[deletion] Failed to delete user:", err);
    });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

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

// Avatar routes in a separate group to avoid Elysia's body parsing
// from the PATCH /@me route consuming the multipart form data
const avatarRoutes = new Elysia({ prefix: "/api/users" })
  .resolve(authResolve())
  .onParse({ as: "local" }, async ({ request, contentType }) => {
    if (contentType?.startsWith("multipart/form-data")) {
      return await request.formData();
    }
  })
  .patch("/@me/avatar", async ({ user: sessionUser, body: rawBody, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 300_000, "avatar-up"))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    if (!isR2Configured()) {
      throw new AppError(
        "AvatarUploadDisabled",
        501,
        "AVATAR_UPLOAD_DISABLED",
        "Avatar upload is not configured",
      );
    }

    const formData = rawBody as FormData;
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
  .delete("/@me/avatar", async ({ user: sessionUser, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 300_000, "avatar-del"))) {
      throw new RateLimitError("Too many requests, try again later");
    }

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
  });

export const userRoutes = new Elysia()
  .use(avatarRoutes)
  .group("/api/users", (app) => app
  .resolve(authResolve())
  .get("/@me", async ({ user: sessionUser }) => {
    const [dbUser] = await db.select().from(user).where(eq(user.id, sessionUser.id)).limit(1);

    if (!dbUser) {
      throw new NotFoundError("User");
    }

    return serializeUser(dbUser);
  })
  .get("/search", async ({ user: sessionUser, query }) => {
    const searchSchema = z.object({ q: z.string().min(1).max(32) });
    const parsed = searchSchema.safeParse(query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid search query");
    }

    await checkUserRateLimit(
      sessionUser.id,
      "users:search",
      RATE_LIMIT_USER_SEARCH.limit,
      RATE_LIMIT_USER_SEARCH.windowMs,
    );

    // Escape LIKE wildcards in user input
    const escaped = parsed.data.q.replace(/[%_\\]/g, (ch: string) => `\\${ch}`);

    const results = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      .from(user)
      .where(and(
        or(ilike(user.username, `%${escaped}%`), ilike(user.displayName, `%${escaped}%`)),
        ne(user.id, sessionUser.id),
      ))
      .limit(3);

    return {
      users: results
        .filter((u) => u.username !== null)
        .map((u) => ({
          id: userId(u.id),
          username: u.username!,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        })),
    };
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
  .post("/@me/password", async ({ body, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 5, 900_000, "pwd"))) {
      throw new RateLimitError("Too many requests, try again later");
    }

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
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 3, 900_000, "acct-del"))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    // If there's already a pending deletion, reject
    if (pendingDeletions.has(sessionUser.id)) {
      throw new ConflictError("DELETION_PENDING", "Account deletion is already in progress");
    }

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

    // Schedule deletion with 10-second countdown
    const expiresAt = new Date(Date.now() + 10_000);
    const timer = setTimeout(() => executeDeletion(sessionUser.id, dbUser.avatarUrl), 10_000);
    pendingDeletions.set(sessionUser.id, { timer, avatarUrl: dbUser.avatarUrl });

    // Notify the user via WebSocket
    sendToUser(sessionUser.id, {
      op: Opcode.ACCOUNT_DELETION_PENDING,
      d: { expiresAt: expiresAt.toISOString() },
    });

    return { success: true, pending: true, expiresAt: expiresAt.toISOString() };
  })
  .post("/@me/cancel-deletion", async ({ user: sessionUser }) => {
    const pending = pendingDeletions.get(sessionUser.id);
    if (!pending) {
      throw new ConflictError("NO_PENDING_DELETION", "No pending deletion to cancel");
    }

    clearTimeout(pending.timer);
    pendingDeletions.delete(sessionUser.id);

    sendToUser(sessionUser.id, {
      op: Opcode.ACCOUNT_DELETION_CANCELLED,
      d: null,
    });

    return { success: true };
  }));
