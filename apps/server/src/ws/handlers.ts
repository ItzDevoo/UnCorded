import { eq, and, or, ne, inArray } from "drizzle-orm";
import {
  Opcode,
  CloseCode,
  encode,
  userId,
  serverId,
  dmChannelId,
  identifyRequestSchema,
} from "@uncorded/protocol";
import { LIST_PAGE_LIMIT } from "@uncorded/shared";
import { db } from "../db/index.js";
import { user, servers, channels, members, dmMembers, friendships } from "../db/schema.js";
import { addConnection, type AnyServerWebSocket } from "./connections.js";
import { registerUserServers } from "./server-members.js";
import { seedChannelCache } from "./channel-cache.js";
import { consumeTicket } from "../routes/gateway.js";
import { resetIdleTimer, setManualDnd, broadcastPresence } from "./presence.js";

type IdentifyResult =
  | { success: true; userId: string; username: string | null; subscriptionTier: string }
  | { success: false; closeCode: number; closeReason: string };

export async function handleIdentify(
  ws: AnyServerWebSocket,
  data: unknown,
): Promise<IdentifyResult> {
  const parsed = identifyRequestSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      closeCode: CloseCode.MISSING_TOKEN,
      closeReason: "Missing ticket in IDENTIFY",
    };
  }
  const ticket = parsed.data.ticket;

  try {
    // Validate one-time ticket
    const ticketUserId = await consumeTicket(ticket);
    if (!ticketUserId) {
      return {
        success: false,
        closeCode: CloseCode.INVALID_SESSION,
        closeReason: "Invalid or expired ticket",
      };
    }

    const identifiedUserId = ticketUserId;

    // Register connection
    addConnection(identifiedUserId, ws);

    // Load user record + check current status in a single query
    const [dbUserRow] = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        subscriptionTier: user.subscriptionTier,
      })
      .from(user)
      .where(eq(user.id, identifiedUserId))
      .limit(1);

    if (!dbUserRow) {
      return {
        success: false,
        closeCode: CloseCode.INVALID_SESSION,
        closeReason: "User not found",
      };
    }

    // Preserve DND across reconnects — conditional update avoids TOCTOU race
    if (dbUserRow.status === "dnd") {
      setManualDnd(identifiedUserId);
    } else {
      // Only set online if status hasn't been changed to DND between SELECT and UPDATE
      await db
        .update(user)
        .set({ status: "online" })
        .where(and(eq(user.id, identifiedUserId), ne(user.status, "dnd")));
    }

    const effectiveStatus = dbUserRow.status === "dnd" ? "dnd" : "online";
    const dbUser = { ...dbUserRow, id: userId(dbUserRow.id) };

    // Batch 1: three independent queries in parallel
    const [userServers, myDmMemberships, friendshipRows] = await Promise.all([
      db
        .select({
          id: servers.id,
          name: servers.name,
          iconUrl: servers.iconUrl,
          ownerId: servers.ownerId,
        })
        .from(servers)
        .innerJoin(members, eq(members.serverId, servers.id))
        .where(eq(members.userId, identifiedUserId)),
      db
        .select({ channelId: dmMembers.channelId })
        .from(dmMembers)
        .where(eq(dmMembers.userId, identifiedUserId)),
      db
        .select({
          usrId: friendships.userId,
          frdId: friendships.friendId,
          status: friendships.status,
        })
        .from(friendships)
        .where(
          and(
            or(
              eq(friendships.userId, identifiedUserId),
              eq(friendships.friendId, identifiedUserId),
            ),
            or(eq(friendships.status, "accepted"), eq(friendships.status, "pending")),
          ),
        ),
    ]);

    const serverIds = userServers.map((s) => s.id);
    const dmChannelIds = myDmMemberships.map((m) => m.channelId);
    const peerIds = friendshipRows.map((r) => (r.usrId === identifiedUserId ? r.frdId : r.usrId));

    // Batch 2: three dependent queries in parallel (guarded by empty-array checks)
    const [userChannels, otherDmMembers, peerUsers] = await Promise.all([
      serverIds.length > 0
        ? db
            .select({
              id: channels.id,
              serverId: channels.serverId,
              name: channels.name,
              type: channels.type,
              position: channels.position,
              topic: channels.topic,
              fileSharingEnabled: channels.fileSharingEnabled,
            })
            .from(channels)
            .where(inArray(channels.serverId, serverIds))
        : Promise.resolve(
            [] as {
              id: string;
              serverId: string;
              name: string;
              type: "text" | "category";
              position: number;
              topic: string | null;
              fileSharingEnabled: boolean;
            }[],
          ),
      dmChannelIds.length > 0
        ? db
            .select({
              channelId: dmMembers.channelId,
              userId: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              status: user.status,
            })
            .from(dmMembers)
            .innerJoin(user, eq(user.id, dmMembers.userId))
            .where(
              and(
                inArray(dmMembers.channelId, dmChannelIds),
                ne(dmMembers.userId, identifiedUserId),
              ),
            )
        : Promise.resolve(
            [] as {
              channelId: string;
              userId: string;
              username: string | null;
              displayName: string | null;
              avatarUrl: string | null;
              status: string;
            }[],
          ),
      peerIds.length > 0
        ? db
            .select({
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              status: user.status,
            })
            .from(user)
            .where(inArray(user.id, peerIds))
        : Promise.resolve(
            [] as {
              id: string;
              username: string | null;
              displayName: string | null;
              avatarUrl: string | null;
              status: string;
            }[],
          ),
    ]);

    /* oxlint-disable no-map-spread -- copy-on-write required, DB rows must not be mutated */
    const readyServers = userServers.map((s) => ({
      ...s,
      id: serverId(s.id),
      ownerId: userId(s.ownerId),
    }));
    /* oxlint-enable no-map-spread */

    const readyDmChannels = otherDmMembers.map((m) => ({
      id: dmChannelId(m.channelId),
      otherUser: {
        id: userId(m.userId),
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        status: m.status,
      },
    }));

    const dmCacheSeed = otherDmMembers.map((m) => ({
      id: m.channelId,
      memberIds: [identifiedUserId, m.userId],
    }));

    const peerMap = new Map(peerUsers.map((u) => [u.id, u]));
    const readyFriends = friendshipRows.map((r) => {
      const peerId = r.usrId === identifiedUserId ? r.frdId : r.usrId;
      const peer = peerMap.get(peerId);
      return {
        userId: userId(peerId),
        username: peer?.username ?? null,
        displayName: peer?.displayName ?? null,
        avatarUrl: peer?.avatarUrl ?? null,
        status: peer?.status ?? "offline",
        friendshipStatus: r.status,
        incoming: r.frdId === identifiedUserId && r.status === "pending",
      };
    });

    // Paginate DMs and friends in READY payload
    const hasMoreDmChannels = readyDmChannels.length > LIST_PAGE_LIMIT;
    const hasMoreFriends = readyFriends.length > LIST_PAGE_LIMIT;
    const slicedDmChannels = hasMoreDmChannels
      ? readyDmChannels.slice(0, LIST_PAGE_LIMIT)
      : readyDmChannels;
    const slicedFriends = hasMoreFriends ? readyFriends.slice(0, LIST_PAGE_LIMIT) : readyFriends;

    // Send READY
    ws.send(
      Buffer.from(
        encode({
          op: Opcode.READY,
          d: {
            user: dbUser,
            servers: readyServers,
            dmChannels: slicedDmChannels,
            hasMoreDmChannels,
            friends: slicedFriends,
            hasMoreFriends,
          },
        }),
      ),
    );

    // Seed channel cache for O(1) lookups during message handling
    seedChannelCache(
      userChannels.map((ch) => ({ id: ch.id, serverId: ch.serverId })),
      dmCacheSeed,
    );

    registerUserServers(identifiedUserId, serverIds);

    // Start idle timer (skipped if DND) and broadcast presence to friends/server members
    resetIdleTimer(identifiedUserId);
    // Fire-and-forget: don't block IDENTIFY response
    broadcastPresence(identifiedUserId, effectiveStatus).catch((err) => {
      if (process.env.NODE_ENV !== "production")
        console.error(
          "[presence] broadcastPresence failed:",
          identifiedUserId,
          effectiveStatus,
          err,
        );
    });

    return {
      success: true,
      userId: identifiedUserId,
      username: dbUserRow.username,
      subscriptionTier: dbUserRow.subscriptionTier,
    };
  } catch (err) {
    console.error(
      "[handlers] Unexpected error in IDENTIFY:",
      err instanceof Error ? err.message : String(err),
    );
    if (err instanceof Error && err.stack) console.error(err.stack);
    return {
      success: false,
      closeCode: CloseCode.INVALID_SESSION,
      closeReason: "Internal error during identification",
    };
  }
}
