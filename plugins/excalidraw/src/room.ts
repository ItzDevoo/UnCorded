import type { ServerWebSocket } from "bun";
import { saveBoard, getBoard } from "./boards.js";

interface Client {
  id: string;
  ws: ServerWebSocket<{ boardId: string; clientId: string }>;
}

interface Room {
  boardId: string;
  clients: Set<Client>;
  saveTimer: ReturnType<typeof setInterval> | null;
  lastElements: unknown[] | null;
}

const rooms = new Map<string, Room>();

const AUTO_SAVE_INTERVAL = 30_000;

function getOrCreateRoom(boardId: string): Room {
  let room = rooms.get(boardId);
  if (!room) {
    room = {
      boardId,
      clients: new Set(),
      saveTimer: null,
      lastElements: null,
    };
    rooms.set(boardId, room);
  }
  return room;
}

function startAutoSave(room: Room): void {
  if (room.saveTimer) return;
  room.saveTimer = setInterval(() => {
    if (room.lastElements) {
      saveBoard(room.boardId, { elements: room.lastElements }).catch((err) => {
        console.error(`Auto-save failed for board ${room.boardId}:`, err);
      });
    }
  }, AUTO_SAVE_INTERVAL);
}

function stopAutoSave(room: Room): void {
  if (room.saveTimer) {
    clearInterval(room.saveTimer);
    room.saveTimer = null;
  }
}

export function addClient(ws: ServerWebSocket<{ boardId: string; clientId: string }>): void {
  const { boardId, clientId } = ws.data;
  const room = getOrCreateRoom(boardId);
  const client: Client = { id: clientId, ws };
  room.clients.add(client);
  startAutoSave(room);

  // Tell the new client their assigned ID
  trySend(ws, JSON.stringify({ type: "client-id", id: clientId }));

  // Send current scene to the new client — prefer in-memory over disk
  if (room.lastElements && room.lastElements.length > 0) {
    trySend(ws, JSON.stringify({ type: "scene-init", elements: room.lastElements }));
    broadcastRoomUsers(room);
  } else {
    getBoard(boardId).then((data) => {
      if (data && data.elements.length > 0) {
        trySend(ws, JSON.stringify({ type: "scene-init", elements: data.elements }));
      }
      broadcastRoomUsers(room);
    });
  }
}

export function removeClient(ws: ServerWebSocket<{ boardId: string; clientId: string }>): void {
  const { boardId } = ws.data;
  const room = rooms.get(boardId);
  if (!room) return;

  for (const client of room.clients) {
    if (client.ws === ws) {
      room.clients.delete(client);
      break;
    }
  }

  broadcastRoomUsers(room);

  if (room.clients.size === 0) {
    stopAutoSave(room);
    if (room.lastElements) {
      saveBoard(room.boardId, { elements: room.lastElements }).catch((err) => {
        console.error(`Final save failed for board ${room.boardId}:`, err);
      });
    }
    rooms.delete(boardId);
  }
}

export function handleMessage(
  ws: ServerWebSocket<{ boardId: string; clientId: string }>,
  message: string | Buffer
): void {
  const { boardId, clientId } = ws.data;
  const room = rooms.get(boardId);
  if (!room) return;

  if (typeof message === "string") {
    try {
      const parsed = JSON.parse(message);

      if (parsed.type === "scene-update" && Array.isArray(parsed.elements)) {
        // Track for auto-save
        room.lastElements = parsed.elements;

        // Relay to all other clients with sender's clientId
        const relayMsg = JSON.stringify({
          type: "scene-update",
          elements: parsed.elements,
          clientId,
        });
        for (const client of room.clients) {
          if (client.ws !== ws) {
            trySend(client.ws, relayMsg);
          }
        }
        return;
      }

      if (parsed.type === "pointer-update") {
        // Volatile relay — don't track, just forward with clientId
        const relayMsg = JSON.stringify({
          type: "pointer-update",
          clientId,
          pointer: parsed.pointer,
          button: parsed.button,
        });
        for (const client of room.clients) {
          if (client.ws !== ws) {
            trySend(client.ws, relayMsg);
          }
        }
        return;
      }
    } catch {
      // Non-JSON or malformed — ignore
    }
  }
}

function broadcastRoomUsers(room: Room): void {
  const clients = Array.from(room.clients).map((c) => ({ id: c.id }));
  const msg = JSON.stringify({
    type: "room-users",
    clients,
  });
  for (const client of room.clients) {
    trySend(client.ws, msg);
  }
}

function trySend(ws: ServerWebSocket<unknown>, msg: string): void {
  try {
    ws.send(msg);
  } catch {
    // Client may have disconnected
  }
}

export function getAllRoomCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [boardId, room] of rooms) {
    counts.set(boardId, room.clients.size);
  }
  return counts;
}
