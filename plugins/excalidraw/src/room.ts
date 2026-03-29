import type { ServerWebSocket } from "bun";
import { saveBoard, getBoard, saveImage, getImages } from "./boards.js";

interface Client {
  id: string;
  ws: ServerWebSocket<{ boardId: string; clientId: string }>;
}

interface Room {
  boardId: string;
  clients: Set<Client>;
  saveTimer: ReturnType<typeof setInterval> | null;
  lastElements: unknown[] | null;
  sceneVersion: number;
  lastSavedVersion: number;
  savePending: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

const AUTO_SAVE_INTERVAL = 30_000;
const DEBOUNCE_SAVE_MS = 5_000;

function computeSceneVersion(elements: unknown[]): number {
  let sum = 0;
  for (const el of elements) {
    if (el && typeof el === "object" && "version" in el) {
      sum += (el as { version: number }).version;
    }
  }
  return sum;
}

function getOrCreateRoom(boardId: string): Room {
  let room = rooms.get(boardId);
  if (!room) {
    room = {
      boardId,
      clients: new Set(),
      saveTimer: null,
      lastElements: null,
      sceneVersion: 0,
      lastSavedVersion: 0,
      savePending: null,
    };
    rooms.set(boardId, room);
  }
  return room;
}

function debounceSave(room: Room): void {
  if (room.savePending) clearTimeout(room.savePending);
  room.savePending = setTimeout(() => {
    room.savePending = null;
    if (room.lastElements && room.sceneVersion >= room.lastSavedVersion) {
      room.lastSavedVersion = room.sceneVersion;
      saveBoard(room.boardId, {
        elements: room.lastElements,
        version: room.sceneVersion,
      }).catch((err) => {
        console.error(`Debounced save failed for board ${room.boardId}:`, err);
      });
    }
  }, DEBOUNCE_SAVE_MS);
}

function startAutoSave(room: Room): void {
  if (room.saveTimer) return;
  room.saveTimer = setInterval(() => {
    if (room.lastElements && room.sceneVersion >= room.lastSavedVersion) {
      room.lastSavedVersion = room.sceneVersion;
      saveBoard(room.boardId, {
        elements: room.lastElements,
        version: room.sceneVersion,
      }).catch((err) => {
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
  if (room.savePending) {
    clearTimeout(room.savePending);
    room.savePending = null;
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

  // If other clients exist, request fresh scene from one of them
  if (room.clients.size > 1) {
    for (const existing of room.clients) {
      if (existing.ws !== ws) {
        trySend(existing.ws, JSON.stringify({ type: "request-scene" }));
        break;
      }
    }
  }

  // Send current scene — prefer in-memory over disk
  if (room.lastElements && room.lastElements.length > 0) {
    trySend(ws, JSON.stringify({ type: "scene-init", elements: room.lastElements }));
    sendImagesAndBroadcast(room, ws, boardId);
  } else {
    getBoard(boardId).then((data) => {
      if (data) {
        room.sceneVersion = data.version ?? computeSceneVersion(data.elements);
        room.lastSavedVersion = room.sceneVersion;
        if (data.elements.length > 0) {
          trySend(ws, JSON.stringify({ type: "scene-init", elements: data.elements }));
        }
      }
      sendImagesAndBroadcast(room, ws, boardId);
    });
  }
}

function sendImagesAndBroadcast(
  room: Room,
  ws: ServerWebSocket<{ boardId: string; clientId: string }>,
  boardId: string,
): void {
  // Send existing images to new client
  getImages(boardId).then((images) => {
    for (const img of images) {
      trySend(ws, JSON.stringify({ type: "image-init", id: img.id, dataURL: img.dataURL, mimeType: img.mimeType }));
    }
  }).catch(() => {});
  broadcastRoomUsers(room);
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
    if (room.lastElements && room.sceneVersion >= room.lastSavedVersion) {
      room.lastSavedVersion = room.sceneVersion;
      saveBoard(room.boardId, {
        elements: room.lastElements,
        version: room.sceneVersion,
      }).catch((err) => {
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
        // Version check — only accept if version >= current
        const incomingVersion = computeSceneVersion(parsed.elements);

        // Merge: apply incoming elements on top of existing
        if (room.lastElements) {
          const localMap = new Map<string, unknown>();
          for (const el of room.lastElements) {
            if (el && typeof el === "object" && "id" in el) {
              localMap.set((el as { id: string }).id, el);
            }
          }
          for (const el of parsed.elements) {
            if (el && typeof el === "object" && "id" in el) {
              const local = localMap.get((el as { id: string }).id);
              const localVer = local && typeof local === "object" && "version" in local
                ? (local as { version: number }).version : 0;
              const remoteVer = (el as { version?: number }).version ?? 0;
              if (remoteVer >= localVer) {
                localMap.set((el as { id: string }).id, el);
              }
            }
          }
          room.lastElements = Array.from(localMap.values());
        } else {
          room.lastElements = parsed.elements;
        }

        const mergedVersion = computeSceneVersion(room.lastElements);
        if (mergedVersion >= room.sceneVersion) {
          room.sceneVersion = mergedVersion;
        }

        debounceSave(room);

        // Relay to all other clients
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

      if (parsed.type === "scene-init" && Array.isArray(parsed.elements)) {
        // Response to request-scene — update room state and forward to new clients
        const version = computeSceneVersion(parsed.elements);
        if (version >= room.sceneVersion) {
          room.lastElements = parsed.elements;
          room.sceneVersion = version;
        }
        // Forward to all clients except sender (new joiners get fresh state)
        const msg = JSON.stringify({ type: "scene-init", elements: parsed.elements });
        for (const client of room.clients) {
          if (client.ws !== ws) {
            trySend(client.ws, msg);
          }
        }
        return;
      }

      if (parsed.type === "pointer-update") {
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

      if (parsed.type === "image-add" && parsed.id && parsed.dataURL) {
        // Save image to disk
        saveImage(boardId, parsed.id, {
          dataURL: parsed.dataURL,
          mimeType: parsed.mimeType ?? "image/png",
        }).catch((err) => {
          console.error(`Image save failed for ${parsed.id}:`, err);
        });

        // Broadcast to other clients
        const relayMsg = JSON.stringify({
          type: "image-add",
          id: parsed.id,
          dataURL: parsed.dataURL,
          mimeType: parsed.mimeType ?? "image/png",
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
