import { Opcode, CloseCode, encode, decodeClient as decode, readyEventSchema } from "@uncorded/protocol";
import type { GatewayFrame } from "@uncorded/protocol";
import { API_BASE } from "./config.js";
import {
  setGatewayStatus,
  setReadyPayload,
  clearReadyPayload,
  setLastCloseCode,
  type ReadyData,
} from "./gateway-store.js";
import { setupStores } from "../stores/index.js";

const WS_URL = API_BASE
  ? API_BASE.replace(/^http/, "ws") + "/gateway"
  : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/gateway`;

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

let ws: WebSocket | null = null;
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
  const socket = ws;
  heartbeatTimer = setInterval(() => {
    if (socket === null || socket !== ws || socket.readyState !== WebSocket.OPEN) return;
    sendFrame({ op: Opcode.HEARTBEAT, d: null });

    // If server doesn't ACK within 10s, consider connection dead
    if (heartbeatAckTimeout === null) {
      heartbeatAckTimeout = setTimeout(() => {
        heartbeatAckTimeout = null;
        if (ws === socket) {
          socket.close(CloseCode.HEARTBEAT_TIMEOUT, "heartbeat_ack_timeout");
        }
      }, HEARTBEAT_ACK_TIMEOUT_MS);
    }
  }, intervalMs);
}

async function fetchTicketAndIdentify() {
  try {
    const res = await fetch(`${API_BASE}/api/gateway/ticket`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      ws?.close(CloseCode.INVALID_SESSION, "ticket_fetch_failed");
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const ticket = typeof data?.ticket === "string" ? data.ticket : null;
    if (!ticket) {
      ws?.close(CloseCode.INVALID_SESSION, "invalid_ticket_response");
      return;
    }
    sendFrame({ op: Opcode.IDENTIFY, d: { ticket } });
  } catch {
    ws?.close(CloseCode.INVALID_SESSION, "ticket_fetch_failed");
  }
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
      fetchTicketAndIdentify();
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
      setupStores(); // Always re-init stores on READY (handles reconnect)
      dispatch(Opcode.READY, parsed.data);
      break;
    }
    case Opcode.HEARTBEAT_ACK: {
      if (event.currentTarget !== ws) break;
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
  // Stale-socket guard: if connect() already replaced ws with a new
  // WebSocket, the old socket's close event is irrelevant.
  if (event.currentTarget !== ws) return;

  clearTimers();
  setGatewayStatus("disconnected");
  setLastCloseCode(event.code);
  ws = null;

  if (intentionalClose) return;

  // Auth failures — reconnecting won't help
  if (event.code === CloseCode.MISSING_TOKEN || event.code === CloseCode.INVALID_SESSION) {
    clearReadyPayload();
    return;
  }

  // Account deleted — reconnecting won't help
  if (event.code === CloseCode.ACCOUNT_DELETED) {
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

/** Cancel any scheduled auto-reconnect so a manual retry doesn't race. */
export function cancelReconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function connectGateway(): void {
  if (import.meta.env.PROD && !WS_URL.startsWith("wss://")) {
    throw new Error("WebSocket must use wss:// in production");
  }
  cancelReconnect();
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
