import { and, eq } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { members, servers } from "../db/schema.js";

/**
 * Verify user is a member of the server. Throws ForbiddenError if not.
 */
export async function requireMember(userId: string, serverId: string) {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    throw new ForbiddenError("Not a server member");
  }

  return member;
}

/**
 * Verify user is the owner of the server. Throws NotFoundError/ForbiddenError.
 */
export async function requireOwner(userId: string, serverId: string) {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);

  if (!server) {
    throw new NotFoundError("Server");
  }

  if (server.ownerId !== userId) {
    throw new ForbiddenError("Not the server owner");
  }

  return server;
}

/**
 * Check if a user is a member of a server (non-throwing).
 */
export async function isMember(userId: string, serverId: string): Promise<boolean> {
  const [member] = await db
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  return !!member;
}
