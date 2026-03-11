import { eq, and, or, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  Opcode,
  CloseCode,
  encode,
  userId,
  serverId,
  channelId,
  dmChannelId,
} from "@uncorded/protocol";
import { db } from "../db/index.js";
import {
  user,
  session as sessionTable,
  servers,
  channels,
  members,
  dmMembers,
  friendships,
} from "../db/schema.js";
import { addConnection, type AnyServerWebSocket } from "./connections.js";
import { registerUserServers } from "./server-members.js";
import { seedChannelCache } from "./channel-cache.js";

const identifySchema = z.object({ token: z.string() });

type IdentifyResult =
  | { success: true; userId: string; username: string | null; subscriptionTier: string }
  | { success: false; closeCode: number; closeReason: string };

export async function handleIdentify(
  ws: AnyServerWebSocket,
  data: unknown,
): Promise<IdentifyResult> {
  const parsed = identifySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      closeCode: CloseCode.MISSING_TOKEN,
      closeReason: "Missing token in IDENTIFY",
    };
  }
  const token = parsed.data.token;

  try {
    // Validate session
    const [sessionRow] = await db
      .select({ userId: sessionTable.userId, expiresAt: sessionTable.expiresAt })
      .from(sessionTable)
      .where(eq(sessionTable.token, token))
      .limit(1);

    if (!sessionRow || new Date(sessionRow.expiresAt) < new Date()) {
      return {
        success: false,
        closeCode: CloseCode.INVALID_SESSION,
        closeReason: "Invalid session",
      };
    }

    const identifiedUserId = sessionRow.userId;

    // Register connection
    addConnection(identifiedUserId, ws);

    // Set user online
    await db.update(user).set({ status: "online" }).where(eq(user.id, identifiedUserId));

    // Load user record
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

    const dbUser = { ...dbUserRow, id: userId(dbUserRow.id) };

    // Load user's servers
    const userServers = await db
      .select({
        id: servers.id,
        name: servers.name,
        iconUrl: servers.iconUrl,
        ownerId: servers.ownerId,
      })
      .from(servers)
      .innerJoin(members, eq(members.serverId, servers.id))
      .where(eq(members.userId, identifiedUserId));

    // Load channels for those servers
    const serverIds = userServers.map((s) => s.id);
    let userChannels: {
      id: string;
      serverId: string;
      name: string;
      type: "text" | "category";
      position: number;
      topic: string | null;
      fileSharingEnabled: boolean;
    }[] = [];

    if (serverIds.length > 0) {
      userChannels = await db
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
        .where(inArray(channels.serverId, serverIds));
    }

    // Build nested READY payload
    const channelsByServer = new Map<string, typeof userChannels>();
    for (const ch of userChannels) {
      let list = channelsByServer.get(ch.serverId);
      if (!list) {
        list = [];
        channelsByServer.set(ch.serverId, list);
      }
      list.push(ch);
    }

    /* oxlint-disable no-map-spread -- copy-on-write required, DB rows must not be mutated */
    const readyServers = userServers.map((s) => ({
      ...s,
      id: serverId(s.id),
      ownerId: userId(s.ownerId),
      channels: (channelsByServer.get(s.id) ?? [])
        .toSorted((a, b) => a.position - b.position)
        .map((ch) => ({ ...ch, id: channelId(ch.id), serverId: serverId(ch.serverId) })),
    }));
    /* oxlint-enable no-map-spread */

    // Load DM channels
    const myDmMemberships = await db
      .select({ channelId: dmMembers.channelId })
      .from(dmMembers)
      .where(eq(dmMembers.userId, identifiedUserId));

    let readyDmChannels: {
      id: ReturnType<typeof dmChannelId>;
      otherUser: {
        id: ReturnType<typeof userId>;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        status: string;
      };
    }[] = [];
    let dmCacheSeed: { id: string; memberIds: string[] }[] = [];

    if (myDmMemberships.length > 0) {
      const dmChannelIds = myDmMemberships.map((m) => m.channelId);
      const otherDmMembers = await db
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
          and(inArray(dmMembers.channelId, dmChannelIds), ne(dmMembers.userId, identifiedUserId)),
        );

      readyDmChannels = otherDmMembers.map((m) => ({
        id: dmChannelId(m.channelId),
        otherUser: {
          id: userId(m.userId),
          username: m.username,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          status: m.status,
        },
      }));

      dmCacheSeed = otherDmMembers.map((m) => ({
        id: m.channelId,
        memberIds: [identifiedUserId, m.userId],
      }));
    }

    // Load friends
    const friendshipRows = await db
      .select({
        usrId: friendships.userId,
        frdId: friendships.friendId,
        status: friendships.status,
      })
      .from(friendships)
      .where(
        and(
          or(eq(friendships.userId, identifiedUserId), eq(friendships.friendId, identifiedUserId)),
          or(eq(friendships.status, "accepted"), eq(friendships.status, "pending")),
        ),
      );

    let readyFriends: {
      userId: ReturnType<typeof userId>;
      username: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      status: string;
      friendshipStatus: string;
      incoming: boolean;
    }[] = [];

    if (friendshipRows.length > 0) {
      const peerIds = friendshipRows.map((r) => (r.usrId === identifiedUserId ? r.frdId : r.usrId));
      const peerUsers = await db
        .select({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.status,
        })
        .from(user)
        .where(inArray(user.id, peerIds));

      const peerMap = new Map(peerUsers.map((u) => [u.id, u]));

      readyFriends = friendshipRows.map((r) => {
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
    }

    // Send READY
    ws.send(
      Buffer.from(
        encode({
          op: Opcode.READY,
          d: {
            user: dbUser,
            servers: readyServers,
            dmChannels: readyDmChannels,
            friends: readyFriends,
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
