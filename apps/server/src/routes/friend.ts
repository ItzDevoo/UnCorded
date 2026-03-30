import { Elysia } from "elysia";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  friendRequestSchema,
  RATE_LIMIT_FRIEND_REQUEST,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@uncorded/shared";
import { validateInput } from "../helpers/validation.js";
import { userPublicFields } from "../helpers/query.js";
import { paginationQuerySchema } from "../helpers/pagination.js";
import {
  Opcode,
  type UserId,
  userId as brandUserId,
  dmChannelId as brandDmChannelId,
} from "@uncorded/protocol";
import { db } from "../db/index.js";
import { friendships, user, bots } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { sendToUser } from "../ws/connections.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { ensureDmChannel } from "../helpers/dm.js";

const userIdParamSchema = z.object({ userId: z.string().min(1) });

export const friendRoutes = new Elysia({ prefix: "/api/friends" })
  .resolve(authResolve())

  // POST /request — Send friend request
  .post("/request", async ({ user: sessionUser, body, set }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot send friend requests");
    }

    await checkUserRateLimit(
      sessionUser.id,
      RL.FRIEND_REQUEST,
      RATE_LIMIT_FRIEND_REQUEST.limit,
      RATE_LIMIT_FRIEND_REQUEST.windowMs,
    );

    const parsed = validateInput(friendRequestSchema, body);

    // Look up target user by username (include profile fields for response)
    const [target] = await db
      .select({ ...userPublicFields, isBot: user.isBot })
      .from(user)
      .where(eq(user.username, parsed.username))
      .limit(1);
    if (!target) {
      // Return same shape as success to prevent username enumeration.
      // No DB records created — this is intentional for privacy.
      set.status = 200;
      return { status: "pending" };
    }

    const targetId = target.id;

    if (targetId === sessionUser.id) {
      throw new ValidationError("Cannot send a friend request to yourself");
    }

    // Bot visibility: only the bot's owner can add it as a friend
    if (target.isBot) {
      const [bot] = await db
        .select({ ownerId: bots.ownerId })
        .from(bots)
        .where(eq(bots.userId, targetId))
        .limit(1);

      if (!bot || bot.ownerId !== sessionUser.id) {
        // Don't reveal the bot exists — same shape as "user not found"
        set.status = 200;
        return { status: "pending" };
      }

      // Owner is adding their own bot — auto-accept immediately
      // Upsert to handle races and repeated adds atomically
      const [upserted] = await db
        .insert(friendships)
        .values({
          userId: sessionUser.id,
          friendId: targetId,
          status: "accepted",
        })
        .onConflictDoUpdate({
          target: [friendships.userId, friendships.friendId],
          set: { status: "accepted" },
        })
        .returning({ status: friendships.status });

      if (!upserted || upserted.status !== "accepted") {
        set.status = 200;
        return { status: "pending" };
      }

      const [me] = await db
        .select({
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.status,
        })
        .from(user)
        .where(eq(user.id, sessionUser.id))
        .limit(1);

      sendToUser(sessionUser.id, {
        op: Opcode.FRIEND_ACCEPT,
        d: {
          userId: brandUserId(targetId),
          username: target.username ?? null,
          displayName: target.displayName ?? null,
          avatarUrl: target.avatarUrl ?? null,
          status: target.status ?? "offline",
        },
      });
      sendToUser(targetId, {
        op: Opcode.FRIEND_ACCEPT,
        d: {
          userId: brandUserId(sessionUser.id),
          username: me?.username ?? null,
          displayName: me?.displayName ?? null,
          avatarUrl: me?.avatarUrl ?? null,
          status: me?.status ?? "offline",
        },
      });

      const dmId = await ensureDmChannel(sessionUser.id, targetId);

      set.status = 200;
      return {
        status: "accepted",
        ...(dmId ? { dmChannelId: brandDmChannelId(dmId) } : {}),
      };
    }

    // Check for existing friendship in either direction
    const [existing] = await db
      .select({
        userId: friendships.userId,
        friendId: friendships.friendId,
        status: friendships.status,
      })
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userId, sessionUser.id), eq(friendships.friendId, targetId)),
          and(eq(friendships.userId, targetId), eq(friendships.friendId, sessionUser.id)),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "blocked") {
        throw new ForbiddenError("Cannot send friend request");
      }
      if (existing.status === "accepted") {
        throw new ValidationError("Already friends");
      }
      // Auto-accept if target already sent us a request
      if (existing.userId === targetId && existing.status === "pending") {
        await db
          .update(friendships)
          .set({ status: "accepted" })
          .where(and(eq(friendships.userId, targetId), eq(friendships.friendId, sessionUser.id)));

        const [me] = await db
          .select({
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            status: user.status,
          })
          .from(user)
          .where(eq(user.id, sessionUser.id))
          .limit(1);

        const [them] = await db
          .select({
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            status: user.status,
          })
          .from(user)
          .where(eq(user.id, targetId))
          .limit(1);

        sendToUser(targetId, {
          op: Opcode.FRIEND_ACCEPT,
          d: {
            userId: brandUserId(sessionUser.id),
            username: me?.username ?? null,
            displayName: me?.displayName ?? null,
            avatarUrl: me?.avatarUrl ?? null,
            status: me?.status ?? "offline",
          },
        });
        sendToUser(sessionUser.id, {
          op: Opcode.FRIEND_ACCEPT,
          d: {
            userId: brandUserId(targetId),
            username: them?.username ?? null,
            displayName: them?.displayName ?? null,
            avatarUrl: them?.avatarUrl ?? null,
            status: them?.status ?? "offline",
          },
        });

        const dmId = await ensureDmChannel(sessionUser.id, targetId);

        set.status = 200;
        return {
          status: "accepted",
          ...(dmId ? { dmChannelId: brandDmChannelId(dmId) } : {}),
        };
      }
      throw new ValidationError("Friend request already pending");
    }

    // Insert new pending friendship
    await db.insert(friendships).values({
      userId: sessionUser.id,
      friendId: targetId,
      status: "pending",
    });

    // Broadcast to target
    const [me] = await db
      .select({
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    sendToUser(targetId, {
      op: Opcode.FRIEND_REQUEST,
      d: {
        userId: brandUserId(sessionUser.id),
        username: me?.username ?? null,
        displayName: me?.displayName ?? null,
        avatarUrl: me?.avatarUrl ?? null,
        status: me?.status ?? "offline",
      },
    });

    // Return target user info so sender can update their local store
    set.status = 201;
    return {
      status: "pending",
      user: {
        userId: brandUserId(targetId),
        username: target.username ?? null,
        displayName: target.displayName ?? null,
        avatarUrl: target.avatarUrl ?? null,
        status: target.status ?? "offline",
      },
    };
  })

  // POST /:userId/accept — Accept friend request
  .post("/:userId/accept", async ({ user: sessionUser, params }) => {
    const parsedParams = userIdParamSchema.safeParse(params);
    if (!parsedParams.success) throw new ValidationError("Invalid user ID");

    const [existing] = await db
      .select({
        userId: friendships.userId,
        friendId: friendships.friendId,
        status: friendships.status,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, params.userId),
          eq(friendships.friendId, sessionUser.id),
          eq(friendships.status, "pending"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Friend request");
    }

    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(and(eq(friendships.userId, params.userId), eq(friendships.friendId, sessionUser.id)));

    const [me] = await db
      .select({
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    const [them] = await db
      .select({
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, params.userId))
      .limit(1);

    sendToUser(params.userId, {
      op: Opcode.FRIEND_ACCEPT,
      d: {
        userId: brandUserId(sessionUser.id),
        username: me?.username ?? null,
        displayName: me?.displayName ?? null,
        avatarUrl: me?.avatarUrl ?? null,
        status: me?.status ?? "offline",
      },
    });
    sendToUser(sessionUser.id, {
      op: Opcode.FRIEND_ACCEPT,
      d: {
        userId: brandUserId(params.userId),
        username: them?.username ?? null,
        displayName: them?.displayName ?? null,
        avatarUrl: them?.avatarUrl ?? null,
        status: them?.status ?? "offline",
      },
    });

    const dmId = await ensureDmChannel(sessionUser.id, params.userId);

    return {
      status: "accepted",
      ...(dmId ? { dmChannelId: brandDmChannelId(dmId) } : {}),
    };
  })

  // POST /:userId/decline — Decline friend request
  .post("/:userId/decline", async ({ user: sessionUser, params, set }) => {
    const parsedParams = userIdParamSchema.safeParse(params);
    if (!parsedParams.success) throw new ValidationError("Invalid user ID");

    const result = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.userId, params.userId),
          eq(friendships.friendId, sessionUser.id),
          eq(friendships.status, "pending"),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundError("Friend request");
    }

    set.status = 204;
  })

  // POST /:userId/block — Block user
  .post("/:userId/block", async ({ user: sessionUser, params }) => {
    const parsedParams = userIdParamSchema.safeParse(params);
    if (!parsedParams.success) throw new ValidationError("Invalid user ID");

    const targetId = params.userId;

    if (targetId === sessionUser.id) throw new ValidationError("Cannot block yourself");

    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!target) throw new NotFoundError("User");

    // Delete any existing friendship in either direction
    await db
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.userId, sessionUser.id), eq(friendships.friendId, targetId)),
          and(eq(friendships.userId, targetId), eq(friendships.friendId, sessionUser.id)),
        ),
      );

    // Insert block
    await db.insert(friendships).values({
      userId: sessionUser.id,
      friendId: targetId,
      status: "blocked",
    });

    sendToUser(targetId, {
      op: Opcode.FRIEND_REMOVE,
      d: { userId: brandUserId(sessionUser.id) },
    });

    return { status: "blocked" };
  })

  // DELETE /:userId — Remove friend
  .delete("/:userId", async ({ user: sessionUser, params, set }) => {
    const parsedParams = userIdParamSchema.safeParse(params);
    if (!parsedParams.success) throw new ValidationError("Invalid user ID");

    const targetId = params.userId;

    if (targetId === sessionUser.id) throw new ValidationError("Cannot remove yourself");

    const result = await db
      .delete(friendships)
      .where(
        and(
          or(
            and(eq(friendships.userId, sessionUser.id), eq(friendships.friendId, targetId)),
            and(eq(friendships.userId, targetId), eq(friendships.friendId, sessionUser.id)),
          ),
          eq(friendships.status, "accepted"),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundError("Friendship");
    }

    sendToUser(targetId, {
      op: Opcode.FRIEND_REMOVE,
      d: { userId: brandUserId(sessionUser.id) },
    });
    sendToUser(sessionUser.id, {
      op: Opcode.FRIEND_REMOVE,
      d: { userId: brandUserId(targetId) },
    });

    set.status = 204;
  })

  // GET / — List accepted friends
  .get("/", async ({ user: sessionUser, query }) => {
    const { limit, offset } = paginationQuerySchema.parse(query);

    const rows = await db
      .select({
        peerId: friendships.friendId,
        peerIdAlt: friendships.userId,
        myId: friendships.userId,
      })
      .from(friendships)
      .where(
        and(
          or(eq(friendships.userId, sessionUser.id), eq(friendships.friendId, sessionUser.id)),
          eq(friendships.status, "accepted"),
        ),
      )
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const peerIds: UserId[] = page.map((r) =>
      r.myId === sessionUser.id ? brandUserId(r.peerId) : brandUserId(r.peerIdAlt),
    );
    if (peerIds.length === 0) return { friends: [], hasMore: false };

    const users = await db
      .select(userPublicFields)
      .from(user)
      .where(inArray(user.id, peerIds));

    return {
      friends: users.map((u) => ({
        userId: brandUserId(u.id),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
      })),
      hasMore,
    };
  })

  // GET /pending — List incoming pending requests
  .get("/pending", async ({ user: sessionUser, query }) => {
    const { limit, offset } = paginationQuerySchema.parse(query);

    const rows = await db
      .select({
        requesterId: friendships.userId,
      })
      .from(friendships)
      .where(and(eq(friendships.friendId, sessionUser.id), eq(friendships.status, "pending")))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) return { pending: [], hasMore: false };

    const requesterIds = page.map((r) => r.requesterId);

    const users = await db
      .select(userPublicFields)
      .from(user)
      .where(inArray(user.id, requesterIds));

    return {
      pending: users.map((u) => ({
        userId: brandUserId(u.id),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
      })),
      hasMore,
    };
  });
