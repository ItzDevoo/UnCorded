/** Loose WS type — Elysia's ws.raw generic varies, so we use a structural type */
export type AnyServerWebSocket = { send(data: string | Buffer): number };
import { eq, and, ne } from "drizzle-orm";
import { encode } from "@uncorded/protocol";
import type { GatewayFrame } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { members, dmMembers } from "../db/schema.js";

/** userId → set of active WebSocket connections (supports multiple tabs) */
export const clients = new Map<string, Set<AnyServerWebSocket>>();

export function addConnection(userId: string, ws: AnyServerWebSocket): void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(ws);
}

export function removeConnection(userId: string, ws: AnyServerWebSocket): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(userId);
}

export function getConnections(userId: string): Set<AnyServerWebSocket> | undefined {
  return clients.get(userId);
}

export function sendToUser(userId: string, frame: GatewayFrame): void {
  const set = clients.get(userId);
  if (!set) return;
  const buf = Buffer.from(encode(frame));
  for (const ws of set) {
    try {
      ws.send(buf);
    } catch {
      // Dead socket — remove silently, loop continues
      set.delete(ws);
      if (set.size === 0) clients.delete(userId);
    }
  }
}

// TODO: cache server membership for broadcast performance
export async function broadcastToServer(
  serverId: string,
  frame: GatewayFrame,
  excludeUserId?: string,
): Promise<void> {
  const memberRows = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.serverId, serverId));

  const buf = Buffer.from(encode(frame));
  for (const row of memberRows) {
    if (row.userId === excludeUserId) continue;
    const set = clients.get(row.userId);
    if (!set) continue;
    for (const ws of set) {
      try {
        ws.send(buf);
      } catch {
        set.delete(ws);
        if (set.size === 0) clients.delete(row.userId);
      }
    }
  }
}

/** Broadcast a frame to all DM members, optionally excluding one user. */
export async function broadcastToDm(
  channelId: string,
  frame: GatewayFrame,
  excludeUserId?: string,
): Promise<void> {
  const dmRows = await db
    .select({ userId: dmMembers.userId })
    .from(dmMembers)
    .where(
      excludeUserId
        ? and(eq(dmMembers.channelId, channelId), ne(dmMembers.userId, excludeUserId))
        : eq(dmMembers.channelId, channelId),
    );

  const buf = Buffer.from(encode(frame));
  for (const row of dmRows) {
    const set = clients.get(row.userId);
    if (!set) continue;
    for (const ws of set) {
      try {
        ws.send(buf);
      } catch {
        set.delete(ws);
        if (set.size === 0) clients.delete(row.userId);
      }
    }
  }
}

export function getConnectedCount(): number {
  return clients.size;
}
