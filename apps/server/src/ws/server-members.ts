// In-memory server membership registry for O(1) broadcast lookups.
// Single-instance only — Redis pub/sub publishes invalidation events for future multi-instance.

import { publishCacheInvalidation, PubSubChannel } from "../lib/redis-pubsub.js";

/** serverId → set of userIds */
const serverMembers = new Map<string, Set<string>>();

/** userId → set of serverIds (reverse index for O(1) disconnect cleanup) */
const userServers = new Map<string, Set<string>>();

/** Populate both maps when a user IDENTIFYs. */
export function registerUserServers(userId: string, serverIds: string[]): void {
  for (const sid of serverIds) {
    let members = serverMembers.get(sid);
    if (!members) {
      members = new Set();
      serverMembers.set(sid, members);
    }
    members.add(userId);
  }

  let servers = userServers.get(userId);
  if (!servers) {
    servers = new Set();
    userServers.set(userId, servers);
  }
  for (const sid of serverIds) {
    servers.add(sid);
  }
}

// ── Internal mutations (no publish — used by subscriber to avoid loops) ──────

function _addMember(srvId: string, uid: string): void {
  let members = serverMembers.get(srvId);
  if (!members) {
    members = new Set();
    serverMembers.set(srvId, members);
  }
  members.add(uid);

  let servers = userServers.get(uid);
  if (!servers) {
    servers = new Set();
    userServers.set(uid, servers);
  }
  servers.add(srvId);
}

function _removeMember(srvId: string, uid: string): void {
  const members = serverMembers.get(srvId);
  if (members) {
    members.delete(uid);
    if (members.size === 0) serverMembers.delete(srvId);
  }

  const servers = userServers.get(uid);
  if (servers) {
    servers.delete(srvId);
    if (servers.size === 0) userServers.delete(uid);
  }
}

/** Apply a cache event from the subscriber (no re-publish). */
export function applyServerMemberEvent(action: unknown, srvId: unknown, uid: unknown): void {
  if (typeof action !== "string" || typeof srvId !== "string" || typeof uid !== "string") return;
  if (action === "add") _addMember(srvId, uid);
  else if (action === "remove") _removeMember(srvId, uid);
}

/** Add a single member (join/create). */
export function addServerMember(serverId: string, userId: string): void {
  _addMember(serverId, userId);

  publishCacheInvalidation(PubSubChannel.SERVER_MEMBERS, {
    action: "add",
    serverId,
    userId,
  });
}

/** Remove a single member (leave/kick). */
export function removeServerMember(serverId: string, userId: string): void {
  _removeMember(serverId, userId);

  publishCacheInvalidation(PubSubChannel.SERVER_MEMBERS, {
    action: "remove",
    serverId,
    userId,
  });
}

/** Remove user from all servers on disconnect (uses reverse index). */
export function removeUserFromAllServers(userId: string): void {
  const servers = userServers.get(userId);
  if (!servers) return;

  for (const sid of servers) {
    const members = serverMembers.get(sid);
    if (members) {
      members.delete(userId);
      if (members.size === 0) serverMembers.delete(sid);
    }
  }

  userServers.delete(userId);
}

/** Remove an entire server (on server delete). */
export function removeServer(serverId: string): void {
  const members = serverMembers.get(serverId);
  if (members) {
    for (const uid of members) {
      const servers = userServers.get(uid);
      if (servers) {
        servers.delete(serverId);
        if (servers.size === 0) userServers.delete(uid);
      }
    }
    serverMembers.delete(serverId);
  }
}

/** Get the set of user IDs in a server (for broadcast). */
export function getServerMembers(serverId: string): ReadonlySet<string> | undefined {
  return serverMembers.get(serverId);
}

/** Get the set of server IDs a user belongs to (for presence broadcast). */
export function getUserServerIds(userId: string): ReadonlySet<string> | undefined {
  return userServers.get(userId);
}
