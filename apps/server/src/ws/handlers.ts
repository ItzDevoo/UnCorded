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

const identifySchema = z.object({ token: z.string() });

type IdentifyResult =
  | { success: true; userId: string }
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

  // Validate session
  const [sessionRow] = await db
    .select({ userId: sessionTable.userId, expiresAt: sessionTable.expiresAt })
    .from(sessionTable)
    .where(eq(sessionTable.token, token))
    .limit(1);

  if (!sessionRow || new Date(sessionRow.expiresAt) < new Date()) {
    return { success: false, closeCode: CloseCode.INVALID_SESSION, closeReason: "Invalid session" };
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

  const dbUser = dbUserRow ? { ...dbUserRow, id: userId(dbUserRow.id) } : null;

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
    type: string;
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

  const readyServers = userServers.map((s) =>
    Object.assign(s, {
      id: serverId(s.id),
      ownerId: userId(s.ownerId),
      channels: (channelsByServer.get(s.id) ?? [])
        .toSorted((a, b) => a.position - b.position)
        .map((ch) => Object.assign(ch, { id: channelId(ch.id), serverId: serverId(ch.serverId) })),
    }),
  );

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
          user: dbUser ?? null,
          servers: readyServers,
          dmChannels: readyDmChannels,
          friends: readyFriends,
        },
      }),
    ),
  );

  return { success: true, userId: identifiedUserId };
}
