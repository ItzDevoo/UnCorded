import { eq, inArray } from "drizzle-orm";
import { Opcode, CloseCode, encode, userId, serverId, channelId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { user, session as sessionTable, servers, channels, members } from "../db/schema.js";
import { addConnection, type AnyServerWebSocket } from "./connections.js";

type IdentifyResult =
  | { success: true; userId: string }
  | { success: false; closeCode: number; closeReason: string };

export async function handleIdentify(
  ws: AnyServerWebSocket,
  data: unknown,
): Promise<IdentifyResult> {
  if (
    !data ||
    typeof data !== "object" ||
    !("token" in data) ||
    typeof (data as Record<string, unknown>).token !== "string"
  ) {
    return {
      success: false,
      closeCode: CloseCode.MISSING_TOKEN,
      closeReason: "Missing token in IDENTIFY",
    };
  }
  const token = (data as Record<string, unknown>).token as string;

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
    })
    .from(user)
    .where(eq(user.id, identifiedUserId))
    .limit(1);

  const dbUser = dbUserRow
    ? { ...dbUserRow, id: userId(dbUserRow.id) }
    : null;

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

  // Send READY
  ws.send(
    Buffer.from(
      encode({
        op: Opcode.READY,
        d: {
          user: dbUser ?? null,
          servers: readyServers,
        },
      }),
    ),
  );

  return { success: true, userId: identifiedUserId };
}
