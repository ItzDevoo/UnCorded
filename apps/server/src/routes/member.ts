import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, ValidationError, NotFoundError } from "@uncorded/shared";
import { Opcode, userId, serverId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { members, servers, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { removeServerMember } from "../ws/server-members.js";
import { broadcastToServer, sendToUser } from "../ws/connections.js";
import { paginationQuerySchema } from "../helpers/pagination.js";

export const memberRoutes = new Elysia({ prefix: "/api/servers/:serverId/members" })
  .resolve(authResolve())
  .get("/", async ({ user: sessionUser, params, query }) => {
    await requireMember(sessionUser.id, params.serverId);

    const { limit, offset } = paginationQuerySchema.parse(query);

    const memberList = await db
      .select({
        userId: members.userId,
        nickname: members.nickname,
        joinedAt: members.joinedAt,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      })
      .from(members)
      .innerJoin(user, eq(user.id, members.userId))
      .where(eq(members.serverId, params.serverId))
      .orderBy(members.joinedAt)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = memberList.length > limit;
    const page = hasMore ? memberList.slice(0, limit) : memberList;

    return {
      members: page.map((m) => Object.assign(m, { userId: userId(m.userId) })),
      hasMore,
    };
  })
  .delete("/@me", async ({ user: sessionUser, params, set }) => {
    await requireMember(sessionUser.id, params.serverId);

    const [server] = await db
      .select({ ownerId: servers.ownerId })
      .from(servers)
      .where(eq(servers.id, params.serverId))
      .limit(1);

    if (server?.ownerId === sessionUser.id) {
      throw new ForbiddenError(
        "Server owner cannot leave. Transfer ownership or delete the server.",
      );
    }

    await db
      .delete(members)
      .where(and(eq(members.userId, sessionUser.id), eq(members.serverId, params.serverId)));

    // Remove from registry before broadcast so leaving user doesn't receive MEMBER_REMOVE
    removeServerMember(params.serverId, sessionUser.id);

    broadcastToServer(params.serverId, {
      op: Opcode.MEMBER_REMOVE,
      d: { serverId: serverId(params.serverId), userId: userId(sessionUser.id) },
    });

    sendToUser(sessionUser.id, {
      op: Opcode.SERVER_DELETE,
      d: { id: serverId(params.serverId) },
    });

    set.status = 204;
  })
  .delete("/:userId", async ({ user: sessionUser, params, set }) => {
    await requireOwner(sessionUser.id, params.serverId);

    if (params.userId === sessionUser.id) {
      throw new ValidationError("Cannot kick yourself");
    }

    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, params.userId), eq(members.serverId, params.serverId)))
      .limit(1);

    if (!member) {
      throw new NotFoundError("Member");
    }

    await db
      .delete(members)
      .where(and(eq(members.userId, params.userId), eq(members.serverId, params.serverId)));

    // Remove from registry before broadcast so kicked user doesn't receive MEMBER_REMOVE
    removeServerMember(params.serverId, params.userId);

    broadcastToServer(params.serverId, {
      op: Opcode.MEMBER_REMOVE,
      d: { serverId: serverId(params.serverId), userId: userId(params.userId) },
    });

    sendToUser(params.userId, {
      op: Opcode.SERVER_DELETE,
      d: { id: serverId(params.serverId) },
    });

    set.status = 204;
  });
