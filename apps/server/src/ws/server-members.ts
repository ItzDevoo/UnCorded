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

/** Add a single member (join/create). */
export function addServerMember(serverId: string, userId: string): void {
  let members = serverMembers.get(serverId);
  if (!members) {
    members = new Set();
    serverMembers.set(serverId, members);
  }
  members.add(userId);

  let servers = userServers.get(userId);
  if (!servers) {
    servers = new Set();
    userServers.set(userId, servers);
  }
  servers.add(serverId);

  publishCacheInvalidation(PubSubChannel.SERVER_MEMBERS, {
    action: "add",
    serverId,
    userId,
  });
}

/** Remove a single member (leave/kick). */
export function removeServerMember(serverId: string, userId: string): void {
  const members = serverMembers.get(serverId);
  if (members) {
    members.delete(userId);
    if (members.size === 0) serverMembers.delete(serverId);
  }

  const servers = userServers.get(userId);
  if (servers) {
    servers.delete(serverId);
    if (servers.size === 0) userServers.delete(userId);
  }

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
