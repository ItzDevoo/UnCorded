import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

export type GatewayStatus = 'disconnected' | 'connecting' | 'connected';

export interface ReadyUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
}

export interface ReadyChannel {
  id: string;
  serverId: string;
  name: string;
  type: string;
  position: number;
  topic: string | null;
}

export interface ReadyServer {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  channels: ReadyChannel[];
}

export interface ReadyData {
  user: ReadyUser;
  servers: ReadyServer[];
}

const [gatewayStatus, setGatewayStatus] = createSignal<GatewayStatus>('disconnected');
const [readyData, setReadyData] = createStore<{ data: ReadyData | null }>({ data: null });

function setReadyPayload(data: ReadyData) {
  setReadyData(reconcile({ data }));
}

function clearReadyPayload() {
  setReadyData(reconcile({ data: null }));
}

export { gatewayStatus, readyData, setGatewayStatus, setReadyPayload, clearReadyPayload };
