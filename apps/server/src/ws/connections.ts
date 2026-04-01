/** Loose WS type — Elysia's ws.raw generic varies, so we use a structural type */
export type AnyServerWebSocket = {
  send(data: string | Buffer): number;
  close(code?: number, reason?: string): void;
};
import { eq } from "drizzle-orm";
import { encode, CloseCode } from "@uncorded/protocol";
import type { GatewayFrame } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { dmMembers } from "../db/schema.js";
import { getServerMembers } from "./server-members.js";
import { lookupDmChannel, addDmChannelToCache } from "./channel-cache.js";

/** userId → set of active WebSocket connections (supports multiple tabs) */
export const clients = new Map<string, Set<AnyServerWebSocket>>();

const MAX_CONNECTIONS_PER_USER = 10;

export function addConnection(userId: string, ws: AnyServerWebSocket): void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }

  // Enforce per-user connection cap — close oldest if at limit
  if (set.size >= MAX_CONNECTIONS_PER_USER) {
    const oldest = set.values().next().value;
    if (oldest) {
      try {
        oldest.close(4008, "Too many connections");
      } catch { /* already closed */ }
      set.delete(oldest);
    }
  }

  set.add(ws);
}

export function removeConnection(userId: string, ws: AnyServerWebSocket): boolean {
  const set = clients.get(userId);
  if (!set) return false;
  set.delete(ws);
  if (set.size === 0) {
    clients.delete(userId);
    return true;
  }
  return false;
}

export function getConnections(userId: string): Set<AnyServerWebSocket> | undefined {
  return clients.get(userId);
}

/** Close all WS connections for a user, forcing reconnect with fresh context. */
export function disconnectUser(
  targetUserId: string,
  closeCode: CloseCode = CloseCode.SESSION_UPDATED,
  reason = "Session updated",
): void {
  const set = clients.get(targetUserId);
  if (!set) return;
  for (const ws of set) {
    try {
      ws.close(closeCode, reason);
    } catch {
      // Already closed — ignore
    }
  }
  set.clear();
  clients.delete(targetUserId);
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

export function broadcastToServer(
  serverId: string,
  frame: GatewayFrame,
  excludeUserId?: string,
): void {
  const memberIds = getServerMembers(serverId);
  if (!memberIds) return;

  const buf = Buffer.from(encode(frame));
  for (const uid of memberIds) {
    if (uid === excludeUserId) continue;
    const set = clients.get(uid);
    if (!set) continue;
    for (const ws of set) {
      try {
        ws.send(buf);
      } catch {
        set.delete(ws);
        if (set.size === 0) clients.delete(uid);
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
  // Cache-first: use in-memory DM member set
  const cachedMembers = lookupDmChannel(channelId);
  if (cachedMembers) {
    const buf = Buffer.from(encode(frame));
    for (const uid of cachedMembers) {
      if (uid === excludeUserId) continue;
      const set = clients.get(uid);
      if (!set) continue;
      for (const ws of set) {
        try {
          ws.send(buf);
        } catch {
          set.delete(ws);
          if (set.size === 0) clients.delete(uid);
        }
      }
    }
    return;
  }

  // DB fallback on cache miss — query ALL members for caching
  const allDmRows = await db
    .select({ userId: dmMembers.userId })
    .from(dmMembers)
    .where(eq(dmMembers.channelId, channelId));

  // Backfill cache with full member set
  const allMemberIds = allDmRows.map((r) => r.userId);
  if (allMemberIds.length > 0) {
    addDmChannelToCache(channelId, allMemberIds);
  }

  const buf = Buffer.from(encode(frame));
  for (const row of allDmRows) {
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

export function getConnectedCount(): number {
  return clients.size;
}
