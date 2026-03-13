import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { UserId, ServerId, ChannelId, DmChannelId } from "@uncorded/protocol";

export type GatewayStatus = "disconnected" | "connecting" | "connected";

export interface ReadyUser {
  id: UserId;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  subscriptionTier: string;
}

export interface ReadyChannel {
  id: ChannelId;
  serverId: ServerId;
  name: string;
  type: string;
  position: number;
  topic: string | null;
  fileSharingEnabled: boolean;
}

export interface ReadyServer {
  id: ServerId;
  name: string;
  iconUrl: string | null;
  ownerId: UserId;
}

export interface ReadyDmChannel {
  id: DmChannelId;
  otherUser: {
    id: UserId;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
  };
}

export interface ReadyFriend {
  userId: UserId;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  friendshipStatus: string;
  incoming: boolean;
}

export interface ReadyData {
  user: ReadyUser;
  servers: ReadyServer[];
  dmChannels: ReadyDmChannel[];
  hasMoreDmChannels: boolean;
  friends: ReadyFriend[];
  hasMoreFriends: boolean;
}

const [gatewayStatus, setGatewayStatus] = createSignal<GatewayStatus>("disconnected");
const [readyData, setReadyData] = createStore<{ data: ReadyData | null }>({ data: null });

// Separate channel cache — channels are fetched lazily per server
const [channelCache, setChannelCache] = createStore<Record<string, ReadyChannel[]>>({});
const [channelCacheLoading, setChannelCacheLoading] = createSignal<string | null>(null);

function setReadyPayload(data: ReadyData) {
  setReadyData(reconcile({ data }));
}

function clearReadyPayload() {
  setReadyData(reconcile({ data: null }));
  setChannelCache(reconcile({}));
}

function addServer(server: ReadyServer) {
  setReadyData("data", "servers", (prev) => [...prev, server]);
}

function setChannelsForServer(sId: ServerId, chs: ReadyChannel[]) {
  setChannelCache(sId, chs);
}

function addChannel(sId: ServerId, channel: ReadyChannel) {
  setChannelCache(sId, (prev) => (prev ? [...prev, channel] : [channel]));
}

function addDmChannel(dm: ReadyDmChannel) {
  // Dedup by channel ID
  setReadyData("data", "dmChannels", (prev) => {
    if (prev.some((d) => d.id === dm.id)) return prev;
    return [...prev, dm];
  });
}

function appendDmChannels(dms: ReadyDmChannel[]) {
  setReadyData("data", "dmChannels", (prev) => {
    const existingIds = new Set(prev.map((d) => d.id));
    const newDms = dms.filter((d) => !existingIds.has(d.id));
    return [...prev, ...newDms];
  });
}

function setHasMoreDmChannels(value: boolean) {
  setReadyData("data", "hasMoreDmChannels", value);
}

function addFriend(friend: ReadyFriend) {
  // Dedup by userId
  setReadyData("data", "friends", (prev) => {
    if (prev.some((f) => f.userId === friend.userId)) return prev;
    return [...prev, friend];
  });
}

function appendFriends(friends: ReadyFriend[]) {
  setReadyData("data", "friends", (prev) => {
    const existingIds = new Set(prev.map((f) => f.userId));
    const newFriends = friends.filter((f) => !existingIds.has(f.userId));
    return [...prev, ...newFriends];
  });
}

function setHasMoreFriends(value: boolean) {
  setReadyData("data", "hasMoreFriends", value);
}

function updateServer(targetServerId: ServerId, updates: Partial<ReadyServer>) {
  setReadyData("data", "servers", (prev) =>
    prev.map((s) => (s.id === targetServerId ? { ...s, ...updates } : s)),
  );
}

function removeServer(targetServerId: ServerId) {
  setReadyData("data", "servers", (prev) => prev.filter((s) => s.id !== targetServerId));
  setChannelCache(targetServerId, undefined!);
}

function removeFriend(targetUserId: UserId) {
  setReadyData("data", "friends", (prev) => prev.filter((f) => f.userId !== targetUserId));
}

function updateFriendStatus(targetUserId: UserId, friendshipStatus: string) {
  setReadyData("data", "friends", (prev) =>
    prev.map((f) => (f.userId === targetUserId ? { ...f, friendshipStatus } : f)),
  );
}

function updateCurrentUser(updates: Partial<ReadyUser>) {
  if (!readyData.data?.user) return;
  setReadyData("data", "user", (prev) => ({ ...prev, ...updates }));
}

function setUserStatus(status: string) {
  setReadyData("data", "user", "status", status);
}

function updatePresence(targetUserId: UserId, status: string) {
  // Update friends list
  setReadyData("data", "friends", (prev) =>
    prev.map((f) => (f.userId === targetUserId ? { ...f, status } : f)),
  );
  // Update DM channels
  setReadyData("data", "dmChannels", (prev) =>
    prev.map((d) =>
      d.otherUser.id === targetUserId ? { ...d, otherUser: { ...d.otherUser, status } } : d,
    ),
  );
}

export {
  gatewayStatus,
  readyData,
  channelCache,
  channelCacheLoading,
  setChannelCacheLoading,
  setGatewayStatus,
  setReadyPayload,
  clearReadyPayload,
  addServer,
  updateServer,
  removeServer,
  setChannelsForServer,
  addChannel,
  addDmChannel,
  appendDmChannels,
  setHasMoreDmChannels,
  addFriend,
  appendFriends,
  setHasMoreFriends,
  removeFriend,
  updateFriendStatus,
  updatePresence,
  updateCurrentUser,
  setUserStatus,
};
