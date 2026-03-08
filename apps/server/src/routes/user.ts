import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { updateUserSchema, NotFoundError, ValidationError, ConflictError } from "@uncorded/shared";
import { userId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .resolve(async ({ status, request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      return status(401, { code: "UNAUTHORIZED", message: "Authentication required" });
    }
    return {
      user: session.user,
      session: session.session,
    };
  })
  .get("/@me", async ({ user: sessionUser }) => {
    const [dbUser] = await db.select().from(user).where(eq(user.id, sessionUser.id)).limit(1);

    if (!dbUser) {
      throw new NotFoundError("User");
    }

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

    return {
      id: userId(updated.id),
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      status: updated.status,
      subscriptionTier: updated.subscriptionTier,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
