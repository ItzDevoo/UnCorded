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

// ── Internal mutations (no publish — used by subscriber to avoid loops) ──────

function _addChannel(chId: string, srvId: string): void {
  serverChannelMap.set(chId, srvId);
}

function _removeChannel(chId: string): void {
  serverChannelMap.delete(chId);
}

function _addDmChannel(dmChId: string, memberIds: string[]): void {
  let members = dmChannelMap.get(dmChId);
  if (!members) {
    members = new Set();
    dmChannelMap.set(dmChId, members);
  }
  for (const uid of memberIds) {
    members.add(uid);
  }
}

/** Apply a channel cache event from the subscriber (no re-publish). */
export function applyChannelEvent(payload: Record<string, unknown>): void {
  const action = payload.action;
  if (typeof action !== "string") return;

  if (action === "add") {
    const chId = payload.channelId;
    const srvId = payload.serverId;
    if (typeof chId !== "string" || typeof srvId !== "string") return;
    _addChannel(chId, srvId);
  } else if (action === "remove") {
    const chId = payload.channelId;
    if (typeof chId !== "string") return;
    _removeChannel(chId);
  }
}

/** Apply a DM member cache event from the subscriber (no re-publish). */
export function applyDmMemberEvent(payload: Record<string, unknown>): void {
  if (payload.action !== "add") return;
  const dmChId = payload.dmChannelId;
  const memberIds = payload.memberIds;
  if (typeof dmChId !== "string" || !Array.isArray(memberIds) || memberIds.length === 0) return;
  if (!memberIds.every((id): id is string => typeof id === "string")) return;
  _addDmChannel(dmChId, memberIds);
}

/** Add a server channel (on channel creation). */
export function addChannelToCache(channelId: string, serverId: string): void {
  _addChannel(channelId, serverId);
  publishCacheInvalidation(PubSubChannel.CHANNELS, {
    action: "add",
    channelId,
    serverId,
  });
}

/** Remove a server channel (on channel deletion). */
export function removeChannelFromCache(channelId: string): void {
  const serverId = serverChannelMap.get(channelId);
  _removeChannel(channelId);
  publishCacheInvalidation(PubSubChannel.CHANNELS, {
    action: "remove",
    channelId,
    serverId: serverId ?? null,
  });
}

/** Add a DM channel (on DM creation). */
export function addDmChannelToCache(dmChannelId: string, memberIds: string[]): void {
  _addDmChannel(dmChannelId, memberIds);
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
