import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { channels, members, dmMembers } from "../db/schema.js";

export type ChannelResolution = { type: "server"; serverId: string } | { type: "dm" };

/**
 * Resolve a channel ID to either a server channel or DM channel,
 * verifying that the given user is a member.
 * Returns null if the channel doesn't exist or the user isn't a member.
 */
export async function resolveChannelMembership(
  userId: string,
  channelId: string,
): Promise<ChannelResolution | null> {
  // Try server channel first
  const [serverCh] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (serverCh) {
    const [mem] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, serverCh.serverId)))
      .limit(1);
    if (!mem) return null;
    return { type: "server", serverId: serverCh.serverId };
  }

  // Try DM channel
  const [dmMem] = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(and(eq(dmMembers.channelId, channelId), eq(dmMembers.userId, userId)))
    .limit(1);

  if (dmMem) return { type: "dm" };

  return null;
}
