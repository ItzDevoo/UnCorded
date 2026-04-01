import WebSocket from "ws";
import { pack, unpack } from "msgpackr";

// --- Protocol types (mirrors @uncorded/protocol) ---

export const Op = {
  HELLO: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  READY: 3,
  HEARTBEAT_ACK: 4,
  MESSAGE_CREATE: 10,
} as const;

export interface Frame {
  op: number;
  d: unknown;
}

export interface HelloData {
  heartbeatInterval: number;
}

export interface ReadyUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  subscriptionTier: string;
  isBot: boolean;
}

export interface ReadyServer {
  id: string;
  name: string;
  iconUrl: string | null;
  channels: Array<{ id: string; name: string; type: string }>;
  members: Array<{ id: string; username: string; displayName: string | null; status?: string }>;
}

export interface ReadyData {
  user: ReadyUser;
  servers: ReadyServer[];
  dmChannels: Array<{ id: string; participants: Array<{ id: string }> }>;
  friends: unknown[];
}

export interface MessageData {
  id: string;
  channelId: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isBot: boolean;
  };
  createdAt: string;
  fileReceipt: unknown | null;
}

function encode(frame: Frame): Buffer {
  return pack(frame);
}

function decode(data: Buffer | ArrayBuffer | Buffer[]): Frame {
  const buf = Buffer.isBuffer(data)
    ? data
    : Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.from(data);
  return unpack(buf) as Frame;
}

// --- Event emitter pattern ---

type GatewayEventMap = {
  ready: [ReadyData];
  message: [MessageData];
  connected: [];
  disconnected: [];
  error: [Error];
  raw: [Frame];
};

type EventHandler<T extends keyof GatewayEventMap> = (...args: GatewayEventMap[T]) => void;

const OpName: Record<number, string> = Object.fromEntries(
  Object.entries(Op).map(([k, v]) => [v, k]),
);

export class GatewayClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private gatewayUrl: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastAck = true;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 60_000;
  private baseReconnectDelay = 5_000;
  private isDestroyed = false;
  private readyData: ReadyData | null = null;

  private listeners = new Map<string, Set<EventHandler<keyof GatewayEventMap>>>();

  constructor(gatewayUrl = "wss://api.uncorded.app/gateway") {
    this.gatewayUrl = gatewayUrl;
  }

  on<T extends keyof GatewayEventMap>(event: T, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<keyof GatewayEventMap>);
  }

  off<T extends keyof GatewayEventMap>(event: T, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<keyof GatewayEventMap>);
  }

  private emit<T extends keyof GatewayEventMap>(event: T, ...args: GatewayEventMap[T]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      try {
        (handler as (...a: GatewayEventMap[T]) => void)(...args);
      } catch (err) {
        console.error(`[gateway] Error in ${event} handler:`, err);
      }
    }
  }

  getReadyData(): ReadyData | null {
    return this.readyData;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(token?: string): Promise<void> {
    if (token) this.token = token;
    if (!this.token) {
      console.error("[gateway] No token set, skipping connect");
      return;
    }
    if (this.isDestroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.gatewayUrl);
      this.ws.binaryType = "nodebuffer";

      this.ws.on("open", () => {
        this.reconnectAttempts = 0;
        this.emit("connected");
      });

      this.ws.on("message", (data: Buffer) => {
        try {
          const frame = decode(data);
          this.handleFrame(frame);
        } catch (err) {
          console.error("[gateway] Failed to decode frame:", err);
        }
      });

      this.ws.on("close", (code, reason) => {
        console.error(`[gateway] Closed: ${code} ${reason.toString()}`);
        this.cleanup();
        this.emit("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[gateway] WebSocket error:", err.message);
        this.emit("error", err);
      });
    } catch (err) {
      console.error("[gateway] Failed to create WebSocket:", err);
      this.scheduleReconnect();
    }
  }

  private handleFrame(frame: Frame): void {
    console.error(`[gateway] << ${OpName[frame.op] ?? `OP_${frame.op}`}`);
    this.emit("raw", frame);

    switch (frame.op) {
      case Op.HELLO: {
        const data = frame.d as HelloData;
        this.startHeartbeat(data.heartbeatInterval);
        this.send({ op: Op.IDENTIFY, d: { token: this.token } });
        break;
      }

      case Op.READY: {
        this.readyData = frame.d as ReadyData;
        console.error(`[gateway] Connected as ${this.readyData.user.username} (${this.readyData.user.id})`);
        console.error(`[gateway] ${this.readyData.servers.length} servers, ${this.readyData.dmChannels.length} DM channels`);
        this.emit("ready", this.readyData);
        break;
      }

      case Op.HEARTBEAT_ACK: {
        this.lastAck = true;
        break;
      }

      case Op.MESSAGE_CREATE: {
        this.emit("message", frame.d as MessageData);
        break;
      }
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.lastAck = true;

    this.heartbeatTimer = setInterval(() => {
      if (!this.lastAck) {
        console.error("[gateway] Heartbeat ACK timeout, reconnecting...");
        this.ws?.close();
        return;
      }
      this.lastAck = false;
      this.send({ op: Op.HEARTBEAT, d: {} });
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(frame: Frame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encode(frame));
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    console.error(`[gateway] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.listeners.clear();
  }
}
