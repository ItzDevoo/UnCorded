import { Opcode, CloseCode, encode, decode, readyEventSchema } from "@uncorded/protocol";
import type { GatewayFrame } from "@uncorded/protocol";
import { API_BASE } from "./config.js";
import {
  setGatewayStatus,
  setReadyPayload,
  clearReadyPayload,
  type ReadyData,
} from "./gateway-store.js";

const WS_URL = API_BASE.replace(/^http/, "ws") + "/gateway";

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

let ws: WebSocket | null = null;
let token: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatAckTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let intentionalClose = false;

const listeners = new Map<Opcode, Set<(data: unknown) => void>>();

function clearTimers() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (heartbeatAckTimeout !== null) {
    clearTimeout(heartbeatAckTimeout);
    heartbeatAckTimeout = null;
  }
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function dispatch(opcode: Opcode, data: unknown) {
  const set = listeners.get(opcode);
  if (set) {
    for (const cb of set) cb(data);
  }
}

const HEARTBEAT_ACK_TIMEOUT_MS = 10_000;

function startHeartbeat(intervalMs: number) {
  if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    sendFrame({ op: Opcode.HEARTBEAT, d: null });

    // If server doesn't ACK within 10s, consider connection dead
    if (heartbeatAckTimeout !== null) clearTimeout(heartbeatAckTimeout);
    heartbeatAckTimeout = setTimeout(() => {
      ws?.close(CloseCode.HEARTBEAT_TIMEOUT, "heartbeat_ack_timeout");
    }, HEARTBEAT_ACK_TIMEOUT_MS);
  }, intervalMs);
}

function handleMessage(event: MessageEvent) {
  if (!(event.data instanceof ArrayBuffer)) return;
  const frame = decode(new Uint8Array(event.data));

  switch (frame.op) {
    case Opcode.HELLO: {
      if (typeof frame.d !== "object" || frame.d === null || !("heartbeatInterval" in frame.d)) {
        break;
      }
      const raw = (frame.d as Record<string, unknown>).heartbeatInterval;
      const interval = Number(raw);
      if (!Number.isFinite(interval) || interval <= 0) break;
      startHeartbeat(interval);
      sendFrame({ op: Opcode.IDENTIFY, d: { token } });
      break;
    }
    case Opcode.READY: {
      const parsed = readyEventSchema.safeParse(frame.d);
      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.error("[gateway] Invalid READY payload:", parsed.error.issues);
        }
        ws?.close();
        break;
      }
      reconnectAttempts = 0;
      setGatewayStatus("connected");
      setReadyPayload(parsed.data as ReadyData);
      dispatch(Opcode.READY, parsed.data);
      break;
    }
    case Opcode.HEARTBEAT_ACK: {
      if (heartbeatAckTimeout !== null) {
        clearTimeout(heartbeatAckTimeout);
        heartbeatAckTimeout = null;
      }
      break;
    }
    default: {
      dispatch(frame.op, frame.d);
    }
  }
}

function handleClose(event: CloseEvent) {
  clearTimers();
  setGatewayStatus("disconnected");
  ws = null;

  if (intentionalClose) return;

  // Auth failures — reconnecting won't help
  if (event.code === CloseCode.MISSING_TOKEN || event.code === CloseCode.INVALID_SESSION) {
    clearReadyPayload();
    return;
  }

  const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  if (ws) {
    ws.close();
    ws = null;
  }

  setGatewayStatus("connecting");
  ws = new WebSocket(WS_URL);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("message", handleMessage);
  ws.addEventListener("close", handleClose);
  ws.addEventListener("error", () => {
    // onerror is always followed by onclose, so no-op here
  });
}

export function connectGateway(sessionToken: string): void {
  token = sessionToken;
  reconnectAttempts = 0;
  intentionalClose = false;
  connect();
}

export function disconnectGateway(): void {
  intentionalClose = true;
  clearTimers();
  listeners.clear();
  if (ws) {
    ws.close();
    ws = null;
  }
  setGatewayStatus("disconnected");
  clearReadyPayload();
}

export function onGatewayEvent(opcode: Opcode, callback: (data: unknown) => void): () => void {
  let set = listeners.get(opcode);
  if (!set) {
    set = new Set();
    listeners.set(opcode, set);
  }
  set.add(callback);

  return () => {
    set.delete(callback);
    if (set.size === 0) listeners.delete(opcode);
  };
}

export function sendFrame(frame: GatewayFrame): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(encode(frame));
  }
}
