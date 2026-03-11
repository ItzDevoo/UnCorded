import { Elysia } from "elysia";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import {
  friendRequestSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  createId,
} from "@uncorded/shared";
import { paginationQuerySchema } from "../helpers/pagination.js";
import {
  Opcode,
  type UserId,
  userId as brandUserId,
  dmChannelId as brandDmChannelId,
} from "@uncorded/protocol";
import { db } from "../db/index.js";
import { friendships, user, dmChannels, dmMembers } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { sendToUser } from "../ws/connections.js";
import { addDmChannelToCache } from "../ws/channel-cache.js";

/**
 * Create a DM channel between two users if one doesn't already exist.
 * Both params are raw user ID strings (not branded) since they come from
 * session/DB. Broadcasts DM_CHANNEL_CREATE to both users on creation.
 */
async function ensureDmChannel(userIdA: string, userIdB: string) {
  // Check for existing DM via intersection query
  const myChannels = db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(eq(dmMembers.userId, userIdA));

  const [existingDm] = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(and(eq(dmMembers.userId, userIdB), eq(dmMembers.channelId, myChannels)))
    .limit(1);

  if (existingDm) return; // DM already exists

  const dmId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(dmChannels).values({ id: dmId });
    await tx.insert(dmMembers).values([
      { channelId: dmId, userId: userIdA },
      { channelId: dmId, userId: userIdB },
    ]);
  });

  addDmChannelToCache(dmId, [userIdA, userIdB]);

  const [userA] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
    })
    .from(user)
    .where(eq(user.id, userIdA))
    .limit(1);

  const [userB] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
    })
    .from(user)
    .where(eq(user.id, userIdB))
    .limit(1);

  sendToUser(userIdA, {
    op: Opcode.DM_CHANNEL_CREATE,
    d: {
      id: brandDmChannelId(dmId),
      otherUser: userB ? { ...userB, id: brandUserId(userB.id) } : null,
    },
  });
  sendToUser(userIdB, {
    op: Opcode.DM_CHANNEL_CREATE,
    d: {
      id: brandDmChannelId(dmId),
      otherUser: userA ? { ...userA, id: brandUserId(userA.id) } : null,
    },
  });
}

const userIdParamSchema = z.object({ userId: z.string().min(1) });

export const friendRoutes = new Elysia({ prefix: "/api/friends" })
  .resolve(authResolve())

  // POST /request — Send friend request
  .post("/request", async ({ user: sessionUser, body, set }) => {
    const parsed = friendRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    // Look up target user by username
    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, parsed.data.username))
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

        await ensureDmChannel(sessionUser.id, targetId);

        set.status = 200;
        return { status: "accepted" };
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

    set.status = 201;
    return { status: "pending" };
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

    await ensureDmChannel(sessionUser.id, params.userId);

    return { status: "accepted" };
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
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(or(...peerIds.map((id) => eq(user.id, id))));

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

    const users = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(or(...page.map((r) => eq(user.id, r.requesterId))));

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
