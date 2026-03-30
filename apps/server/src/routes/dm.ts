import { Elysia } from "elysia";
import { eq, and, or, ne, inArray } from "drizzle-orm";
import { createDmSchema, ValidationError, ForbiddenError } from "@uncorded/shared";
import { dmChannelId as brandDmChannelId, userId as brandUserId } from "@uncorded/protocol";
import { validateInput } from "../helpers/validation.js";
import { userPublicFields } from "../helpers/query.js";
import { db } from "../db/index.js";
import { friendships, dmMembers, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { paginationQuerySchema } from "../helpers/pagination.js";
import { ensureDmChannel } from "../helpers/dm.js";

export const dmRoutes = new Elysia({ prefix: "/api/dms" })
  .resolve(authResolve())

  // POST / — Create or get DM
  .post("/", async ({ user: sessionUser, body, set }) => {
    const parsed = validateInput(createDmSchema, body);

    const targetId = parsed.userId;

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
        .select(userPublicFields)
        .from(user)
        .where(eq(user.id, targetId))
        .limit(1);

      return {
        id: brandDmChannelId(existingDm.channelId),
        otherUser: otherUser ? { ...otherUser, id: brandUserId(otherUser.id) } : null,
      };
    }

    // Create new DM channel (broadcasts to both users)
    const dmId = await ensureDmChannel(sessionUser.id, targetId);

    if (!dmId) {
      // Race condition: DM was created between our check and ensureDmChannel's check
      // Re-query to find it
      const [raceChannel] = await db
        .select({ channelId: dmMembers.channelId })
        .from(dmMembers)
        .where(and(eq(dmMembers.userId, targetId), inArray(dmMembers.channelId,
          db.select({ channelId: dmMembers.channelId }).from(dmMembers).where(eq(dmMembers.userId, sessionUser.id))
        )))
        .limit(1);

      const [otherUser] = await db.select(userPublicFields).from(user).where(eq(user.id, targetId)).limit(1);

      return {
        id: brandDmChannelId(raceChannel!.channelId),
        otherUser: otherUser ? { ...otherUser, id: brandUserId(otherUser.id) } : null,
      };
    }

    // Fetch other user info for HTTP response
    const [otherUser] = await db
      .select(userPublicFields)
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);

    set.status = 201;
    return {
      id: brandDmChannelId(dmId),
      otherUser: otherUser ? { ...otherUser, id: brandUserId(otherUser.id) } : null,
    };
  })

  // GET / — List user's DMs
  .get("/", async ({ user: sessionUser, query }) => {
    const { limit, offset } = paginationQuerySchema.parse(query);

    // Get DM channel IDs for this user (paginated)
    const myDmMembers = await db
      .select({ channelId: dmMembers.channelId })
      .from(dmMembers)
      .where(eq(dmMembers.userId, sessionUser.id))
      .orderBy(dmMembers.channelId)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = myDmMembers.length > limit;
    const page = hasMore ? myDmMembers.slice(0, limit) : myDmMembers;

    if (page.length === 0) return { dmChannels: [], hasMore: false };

    const channelIds = page.map((m) => m.channelId);

    // Get the other members of those channels
    const otherMembers = await db
      .select({
        channelId: dmMembers.channelId,
        userId: dmMembers.userId,
      })
      .from(dmMembers)
      .where(and(inArray(dmMembers.channelId, channelIds), ne(dmMembers.userId, sessionUser.id)));

    if (otherMembers.length === 0) return { dmChannels: [], hasMore };

    // Get user info for other members
    const otherUserIds = otherMembers.map((m) => m.userId);
    const users = await db
      .select(userPublicFields)
      .from(user)
      .where(or(...otherUserIds.map((uid) => eq(user.id, uid))));

    const userMap = new Map(users.map((u) => [u.id, u]));

    const otherMemberMap = new Map(otherMembers.map((m) => [m.channelId, m.userId]));

    return {
      dmChannels: page
        .map((p) => {
          const otherUserId = otherMemberMap.get(p.channelId);
          if (!otherUserId) return null;
          const u = userMap.get(otherUserId);
          return {
            id: brandDmChannelId(p.channelId),
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
        })
        .filter(Boolean),
      hasMore,
    };
  });
