import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { z } from "zod";
import type { UserId, ServerId, ChannelId, DmChannelId } from "@uncorded/protocol";

export type GatewayStatus = "disconnected" | "connecting" | "connected";

export interface ReadyUser {
  id: UserId;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
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
  channels: ReadyChannel[];
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
  friends: ReadyFriend[];
}

export const readyDataSchema = z.object({
  user: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    status: z.string(),
  }),
  servers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      iconUrl: z.string().nullable(),
      ownerId: z.string(),
      channels: z.array(
        z.object({
          id: z.string(),
          serverId: z.string(),
          name: z.string(),
          type: z.string(),
          position: z.number(),
          topic: z.string().nullable(),
          fileSharingEnabled: z.boolean(),
        }),
      ),
    }),
  ),
  dmChannels: z
    .array(
      z.object({
        id: z.string(),
        otherUser: z.object({
          id: z.string(),
          username: z.string().nullable(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
          status: z.string(),
        }),
      }),
    )
    .default([]),
  friends: z
    .array(
      z.object({
        userId: z.string(),
        username: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        status: z.string(),
        friendshipStatus: z.string(),
        incoming: z.boolean(),
      }),
    )
    .default([]),
});

const [gatewayStatus, setGatewayStatus] = createSignal<GatewayStatus>("disconnected");
const [readyData, setReadyData] = createStore<{ data: ReadyData | null }>({ data: null });

function setReadyPayload(data: ReadyData) {
  setReadyData(reconcile({ data }));
}

function clearReadyPayload() {
  setReadyData(reconcile({ data: null }));
}

function addServer(server: ReadyServer) {
  setReadyData("data", "servers", (prev) => [...prev, server]);
}

function addDmChannel(dm: ReadyDmChannel) {
  setReadyData("data", "dmChannels", (prev) => [...prev, dm]);
}

function addFriend(friend: ReadyFriend) {
  setReadyData("data", "friends", (prev) => [...prev, friend]);
}

function removeFriend(targetUserId: UserId) {
  setReadyData("data", "friends", (prev) => prev.filter((f) => f.userId !== targetUserId));
}

function updateFriendStatus(targetUserId: UserId, friendshipStatus: string) {
  setReadyData("data", "friends", (prev) =>
    prev.map((f) => (f.userId === targetUserId ? { ...f, friendshipStatus } : f)),
  );
}

export {
  gatewayStatus,
  readyData,
  setGatewayStatus,
  setReadyPayload,
  clearReadyPayload,
  addServer,
  addDmChannel,
  addFriend,
  removeFriend,
  updateFriendStatus,
};
