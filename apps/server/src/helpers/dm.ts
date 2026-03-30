import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@uncorded/shared";
import { Opcode, dmChannelId as brandDmChannelId, userId as brandUserId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { user, dmChannels, dmMembers } from "../db/schema.js";
import { sendToUser } from "../ws/connections.js";
import { addDmChannelToCache } from "../ws/channel-cache.js";
import { userPublicFields } from "./query.js";

/** Fallback profile for deleted/missing users so otherUser is never null. */
function deletedUserProfile(id: string) {
  return {
    id: brandUserId(id),
    username: null,
    displayName: "[Deleted User]",
    avatarUrl: null,
    status: "offline" as const,
  };
}

function brandProfile(u: { id: string; username: string | null; displayName: string | null; avatarUrl: string | null; status: string }) {
  return { ...u, id: brandUserId(u.id) };
}

/**
 * Create a DM channel between two users if one doesn't already exist.
 * Both params are raw user ID strings (not branded) since they come from
 * session/DB. Broadcasts DM_CHANNEL_CREATE to both users on creation.
 *
 * @returns The raw DM channel ID string if a new channel was created
 *          (creation + broadcast performed), or `null` if the DM channel
 *          already existed (no action taken).
 */
export async function ensureDmChannel(userIdA: string, userIdB: string): Promise<string | null> {
  // Check for existing DM via intersection query
  const myChannels = db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(eq(dmMembers.userId, userIdA));

  const [existingDm] = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(and(eq(dmMembers.userId, userIdB), inArray(dmMembers.channelId, myChannels)))
    .limit(1);

  if (existingDm) return null; // DM already exists

  const dmId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(dmChannels).values({ id: dmId });
    await tx.insert(dmMembers).values([
      { channelId: dmId, userId: userIdA },
      { channelId: dmId, userId: userIdB },
    ]);
  });

  addDmChannelToCache(dmId, [userIdA, userIdB]);

  // Fetch both user profiles in a single query
  const profiles = await db
    .select(userPublicFields)
    .from(user)
    .where(inArray(user.id, [userIdA, userIdB]));

  const userA = profiles.find((u) => u.id === userIdA);
  const userB = profiles.find((u) => u.id === userIdB);

  sendToUser(userIdA, {
    op: Opcode.DM_CHANNEL_CREATE,
    d: {
      id: brandDmChannelId(dmId),
      otherUser: userB ? brandProfile(userB) : deletedUserProfile(userIdB),
    },
  });
  sendToUser(userIdB, {
    op: Opcode.DM_CHANNEL_CREATE,
    d: {
      id: brandDmChannelId(dmId),
      otherUser: userA ? brandProfile(userA) : deletedUserProfile(userIdA),
    },
  });

  return dmId;
}
