import { Elysia } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { members, servers, user } from '../db/schema.js';
import { getSession } from '../middleware/auth.js';
import { requireMember, requireOwner } from '../helpers/permissions.js';

export const memberRoutes = new Elysia({ prefix: '/api/servers/:serverId/members' })
  .resolve(async ({ status, request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      return status(401, { code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
    return {
      user: session.user,
      session: session.session,
    };
  })
  .get('/', async ({ user: sessionUser, params, set }) => {
    const member = await requireMember(sessionUser.id, params.serverId, set);
    if (!member) return { code: 'FORBIDDEN', message: 'Not a server member' };

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

    return memberList;
  })
  .delete('/@me', async ({ user: sessionUser, params, set }) => {
    const member = await requireMember(sessionUser.id, params.serverId, set);
    if (!member) return { code: 'FORBIDDEN', message: 'Not a server member' };

    const [server] = await db
      .select({ ownerId: servers.ownerId })
      .from(servers)
      .where(eq(servers.id, params.serverId))
      .limit(1);

    if (server?.ownerId === sessionUser.id) {
      set.status = 403;
      return { code: 'OWNER_CANNOT_LEAVE', message: 'Server owner cannot leave. Transfer ownership or delete the server.' };
    }

    await db
      .delete(members)
      .where(and(eq(members.userId, sessionUser.id), eq(members.serverId, params.serverId)));

    set.status = 204;
  })
  .delete('/:userId', async ({ user: sessionUser, params, set }) => {
    const server = await requireOwner(sessionUser.id, params.serverId, set);
    if (!server) return { code: 'FORBIDDEN', message: 'Not the server owner' };

    if (params.userId === sessionUser.id) {
      set.status = 400;
      return { code: 'CANNOT_KICK_SELF', message: 'Cannot kick yourself' };
    }

    const member = await requireMember(params.userId, params.serverId, set);
    if (!member) return { code: 'NOT_FOUND', message: 'Member not found' };

    await db
      .delete(members)
      .where(and(eq(members.userId, params.userId), eq(members.serverId, params.serverId)));

    set.status = 204;
  });
