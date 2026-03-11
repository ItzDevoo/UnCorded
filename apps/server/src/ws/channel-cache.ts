// In-memory channel lookup cache for O(1) membership checks.
// Eliminates repeated DB queries on every WS message.
// Single-instance only — publishes invalidation events via Redis for future multi-instance.

import { publishCacheInvalidation, PubSubChannel } from "../lib/redis-pubsub.js";

/** channelId → serverId */
const serverChannelMap = new Map<string, string>();

/** dmChannelId → Set<userId> */
const dmChannelMap = new Map<string, Set<string>>();

/** Populate both maps when a user IDENTIFYs. */
export function seedChannelCache(
  channels: { id: string; serverId: string }[],
  dmChannels: { id: string; memberIds: string[] }[],
): void {
  for (const ch of channels) {
    serverChannelMap.set(ch.id, ch.serverId);
  }

  for (const dm of dmChannels) {
    let members = dmChannelMap.get(dm.id);
    if (!members) {
      members = new Set();
      dmChannelMap.set(dm.id, members);
    }
    for (const uid of dm.memberIds) {
      members.add(uid);
    }
  }
}

/** Add a server channel (on channel creation). */
export function addChannelToCache(channelId: string, serverId: string): void {
  serverChannelMap.set(channelId, serverId);
  publishCacheInvalidation(PubSubChannel.CHANNELS, {
    action: "add",
    channelId,
    serverId,
  });
}

/** Remove a server channel (on channel deletion). */
export function removeChannelFromCache(channelId: string): void {
  const serverId = serverChannelMap.get(channelId);
  serverChannelMap.delete(channelId);
  publishCacheInvalidation(PubSubChannel.CHANNELS, {
    action: "remove",
    channelId,
    serverId: serverId ?? null,
  });
}

/** Add a DM channel (on DM creation). */
export function addDmChannelToCache(dmChannelId: string, memberIds: string[]): void {
  let members = dmChannelMap.get(dmChannelId);
  if (!members) {
    members = new Set();
    dmChannelMap.set(dmChannelId, members);
  }
  for (const uid of memberIds) {
    members.add(uid);
  }
  publishCacheInvalidation(PubSubChannel.DM_MEMBERS, {
    action: "add",
    dmChannelId,
    memberIds,
  });
}

/** Look up a server channel → serverId. */
export function lookupServerChannel(channelId: string): string | undefined {
  return serverChannelMap.get(channelId);
}

/** Look up a DM channel → member set. */
export function lookupDmChannel(channelId: string): ReadonlySet<string> | undefined {
  return dmChannelMap.get(channelId);
}
