import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { members, servers } from '../db/schema.js';

/**
 * Verify user is a member of the server. Returns member row or null (sets 403).
 */
export async function requireMember(
  userId: string,
  serverId: string,
  set: { status?: number | string },
) {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    set.status = 403;
    return null;
  }

  return member;
}

/**
 * Verify user is the owner of the server. Returns server row or null (sets 403/404).
 */
export async function requireOwner(
  userId: string,
  serverId: string,
  set: { status?: number | string },
) {
  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    set.status = 404;
    return null;
  }

  if (server.ownerId !== userId) {
    set.status = 403;
    return null;
  }

  return server;
}
