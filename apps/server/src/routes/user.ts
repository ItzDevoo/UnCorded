import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { updateUserSchema } from '@uncorded/shared';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { getSession } from '../middleware/auth.js';

export const userRoutes = new Elysia({ prefix: '/api/users' })
  .resolve(async ({ status, request: { headers } }) => {
    const session = await getSession(new Headers(headers as HeadersInit));
    if (!session) return status(401);
    return {
      user: session.user,
      session: session.session,
    };
  })
  .get('/@me', async ({ user: sessionUser }) => {
    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    if (!dbUser) {
      throw new Error('User not found');
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      email: dbUser.email,
      avatarUrl: dbUser.avatarUrl,
      status: dbUser.status,
      hasExtendedExpiry: dbUser.hasExtendedExpiry,
      hasCustomAvatar: dbUser.hasCustomAvatar,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };
  })
  .patch('/@me', async ({ user: sessionUser, body, set }) => {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      };
    }

    const updates: Record<string, unknown> = {};

    if (parsed.data.username !== undefined) {
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, parsed.data.username))
        .limit(1);

      if (existing && existing.id !== sessionUser.id) {
        set.status = 409;
        return { code: 'USERNAME_TAKEN', message: 'Username is already taken' };
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
      set.status = 400;
      return { code: 'NO_CHANGES', message: 'No fields to update' };
    }

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, sessionUser.id))
      .returning();

    if (!updated) {
      throw new Error('User not found');
    }

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      status: updated.status,
      hasExtendedExpiry: updated.hasExtendedExpiry,
      hasCustomAvatar: updated.hasCustomAvatar,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
