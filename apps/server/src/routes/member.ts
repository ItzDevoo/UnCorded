import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, ValidationError, NotFoundError } from "@uncorded/shared";
import { userId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { members, servers, user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";

export const memberRoutes = new Elysia({ prefix: "/api/servers/:serverId/members" })
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
  .get("/", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

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
      .where(eq(members.serverId, params.serverId));

    return memberList.map((m) => Object.assign(m, { userId: userId(m.userId) }));
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

    set.status = 204;
  });
