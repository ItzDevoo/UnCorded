import type { ServerWebSocket } from "bun";
import { saveBoard, getBoard } from "./boards.js";
import type { BoardData } from "./boards.js";

interface Client {
  ws: ServerWebSocket<{ boardId: string }>;
}

interface Room {
  boardId: string;
  clients: Set<Client>;
  saveTimer: ReturnType<typeof setInterval> | null;
  lastElements: unknown[] | null;
}

const rooms = new Map<string, Room>();

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

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
  room.saveTimer = setInterval(async () => {
    if (room.lastElements) {
      await saveBoard(room.boardId, { elements: room.lastElements });
    }
  }, AUTO_SAVE_INTERVAL);
}

function stopAutoSave(room: Room): void {
  if (room.saveTimer) {
    clearInterval(room.saveTimer);
    room.saveTimer = null;
  }
}

export function addClient(ws: ServerWebSocket<{ boardId: string }>): void {
  const { boardId } = ws.data;
  const room = getOrCreateRoom(boardId);
  const client: Client = { ws };
  room.clients.add(client);
  startAutoSave(room);

  // Send current board state to the new client
  getBoard(boardId).then((data) => {
    if (data && data.elements.length > 0) {
      try {
        ws.send(
          JSON.stringify({ type: "scene-init", elements: data.elements })
        );
      } catch {
        // Client may have disconnected
      }
    }
  });
}

export function removeClient(ws: ServerWebSocket<{ boardId: string }>): void {
  const { boardId } = ws.data;
  const room = rooms.get(boardId);
  if (!room) return;

  // Find and remove the client
  for (const client of room.clients) {
    if (client.ws === ws) {
      room.clients.delete(client);
      break;
    }
  }

  // Broadcast updated user count
  broadcastUserCount(room);

  // If room is empty, save and clean up
  if (room.clients.size === 0) {
    stopAutoSave(room);
    if (room.lastElements) {
      saveBoard(room.boardId, { elements: room.lastElements });
    }
    rooms.delete(boardId);
  }
}

export function handleMessage(
  ws: ServerWebSocket<{ boardId: string }>,
  message: string | Buffer
): void {
  const { boardId } = ws.data;
  const room = rooms.get(boardId);
  if (!room) return;

  // Try to parse and track elements for auto-save
  if (typeof message === "string") {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === "scene-update" && Array.isArray(parsed.elements)) {
        room.lastElements = parsed.elements;
      }
    } catch {
      // Binary or non-JSON message — relay as-is
    }
  }

  // Relay to all other clients in the room
  for (const client of room.clients) {
    if (client.ws !== ws) {
      try {
        client.ws.send(message);
      } catch {
        // Client may have disconnected
      }
    }
  }
}

function broadcastUserCount(room: Room): void {
  const msg = JSON.stringify({
    type: "user-count",
    count: room.clients.size,
  });
  for (const client of room.clients) {
    try {
      client.ws.send(msg);
    } catch {
      // Ignore
    }
  }
}

export function getRoomUserCount(boardId: string): number {
  return rooms.get(boardId)?.clients.size ?? 0;
}

export function getAllRoomCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [boardId, room] of rooms) {
    counts.set(boardId, room.clients.size);
  }
  return counts;
}
