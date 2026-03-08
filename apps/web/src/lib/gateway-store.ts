import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { UserId, ServerId, ChannelId } from "@uncorded/protocol";

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

export interface ReadyData {
  user: ReadyUser;
  servers: ReadyServer[];
}

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

export {
  gatewayStatus,
  readyData,
  setGatewayStatus,
  setReadyPayload,
  clearReadyPayload,
  addServer,
};
