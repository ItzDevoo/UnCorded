import { Elysia } from "elysia";
import { eq, and, or, ne, inArray } from "drizzle-orm";
import { createDmSchema, ValidationError, ForbiddenError } from "@uncorded/shared";
import { Opcode, dmChannelId as brandDmChannelId, userId as brandUserId } from "@uncorded/protocol";
import { createId } from "@uncorded/shared";
import { db } from "../db/index.js";
import { friendships, dmChannels, dmMembers, user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { sendToUser } from "../ws/connections.js";
import { addDmChannelToCache } from "../ws/channel-cache.js";

export const dmRoutes = new Elysia({ prefix: "/api/dms" })
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

  // POST / — Create or get DM
  .post("/", async ({ user: sessionUser, body, set }) => {
    const parsed = createDmSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const targetId = parsed.data.userId;

    if (targetId === sessionUser.id) {
      throw new ValidationError("Cannot create a DM with yourself");
    }

    // Check friendship is accepted
    const [friendship] = await db
      .select({ status: friendships.status })
      .from(friendships)
      .where(
        and(
          or(
            and(eq(friendships.userId, sessionUser.id), eq(friendships.friendId, targetId)),
            and(eq(friendships.userId, targetId), eq(friendships.friendId, sessionUser.id)),
          ),
          eq(friendships.status, "accepted"),
        ),
      )
      .limit(1);

    if (!friendship) {
      throw new ForbiddenError("Must be friends to create a DM");
    }

    // Check for existing DM via intersection query
    const myChannels = db
      .select({ channelId: dmMembers.channelId })
      .from(dmMembers)
      .where(eq(dmMembers.userId, sessionUser.id));

    const [existingDm] = await db
      .select({ channelId: dmMembers.channelId })
      .from(dmMembers)
      .where(and(eq(dmMembers.userId, targetId), eq(dmMembers.channelId, myChannels)))
      .limit(1);

    if (existingDm) {
      // Load other user info
      const [otherUser] = await db
        .select({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.status,
        })
        .from(user)
        .where(eq(user.id, targetId))
        .limit(1);

      return {
        id: brandDmChannelId(existingDm.channelId),
        otherUser: otherUser ? { ...otherUser, id: brandUserId(otherUser.id) } : null,
      };
    }

    // Create new DM channel
    const dmId = createId();
    await db.transaction(async (tx) => {
      await tx.insert(dmChannels).values({ id: dmId });
      await tx.insert(dmMembers).values([
        { channelId: dmId, userId: sessionUser.id },
        { channelId: dmId, userId: targetId },
      ]);
    });

    addDmChannelToCache(dmId, [sessionUser.id, targetId]);

    const [otherUser] = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);

    const [meUser] = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    const dmPayload = {
      id: brandDmChannelId(dmId),
      otherUser: otherUser ? { ...otherUser, id: brandUserId(otherUser.id) } : null,
    };

    // Broadcast to both users
    sendToUser(sessionUser.id, {
      op: Opcode.DM_CHANNEL_CREATE,
      d: dmPayload,
    });
    sendToUser(targetId, {
      op: Opcode.DM_CHANNEL_CREATE,
      d: {
        id: brandDmChannelId(dmId),
        otherUser: meUser ? { ...meUser, id: brandUserId(meUser.id) } : null,
      },
    });

    set.status = 201;
    return dmPayload;
  })

  // GET / — List user's DMs
  .get("/", async ({ user: sessionUser }) => {
    // Get all DM channel IDs for this user
    const myDmMembers = await db
      .select({ channelId: dmMembers.channelId })
      .from(dmMembers)
      .where(eq(dmMembers.userId, sessionUser.id));

    if (myDmMembers.length === 0) return { dmChannels: [] };

    const channelIds = myDmMembers.map((m) => m.channelId);

    // Get the other members of those channels
    const otherMembers = await db
      .select({
        channelId: dmMembers.channelId,
        userId: dmMembers.userId,
      })
      .from(dmMembers)
      .where(
        and(
          inArray(dmMembers.channelId, channelIds),
          ne(dmMembers.userId, sessionUser.id),
        ),
      );

    if (otherMembers.length === 0) return { dmChannels: [] };

    // Get user info for other members
    const otherUserIds = otherMembers.map((m) => m.userId);
    const users = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(user)
      .where(or(...otherUserIds.map((uid) => eq(user.id, uid))));

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      dmChannels: otherMembers.map((m) => {
        const u = userMap.get(m.userId);
        return {
          id: brandDmChannelId(m.channelId),
          otherUser: u
            ? {
                id: brandUserId(u.id),
                username: u.username,
                displayName: u.displayName,
                avatarUrl: u.avatarUrl,
                status: u.status,
              }
            : null,
        };
      }),
    };
  });
