import { readFile } from "node:fs/promises";
import { join, extname, resolve, normalize } from "node:path";
import { listBoards, createBoard, deleteBoard, getBoard } from "./boards.js";
import {
  addClient,
  removeClient,
  handleMessage,
  getAllRoomCounts,
} from "./room.js";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dir, "..", "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function serveStatic(filePath: string): Promise<Response> {
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    return new Response(content, {
      headers: { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const server = Bun.serve<{ boardId: string; clientId: string }>({
  port: PORT,
  hostname: "0.0.0.0",

  async fetch(req, server) {
    const url = new URL(req.url);
    const { pathname } = url;

    // --- Health check ---
    if (pathname === "/health") {
      return json({ status: "ok" });
    }

    // --- WebSocket upgrade ---
    const wsMatch = pathname.match(/^\/ws\/room\/([a-f0-9-]+)$/);
    if (wsMatch) {
      const boardId = wsMatch[1]!;
      const board = await getBoard(boardId);
      if (!board) {
        return json({ error: "Board not found" }, 404);
      }
      const clientId = crypto.randomUUID();
      const upgraded = server.upgrade(req, { data: { boardId, clientId } });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return;
    }

    // --- API routes ---
    if (pathname === "/api/boards" && req.method === "GET") {
      const boards = await listBoards();
      const roomCounts = getAllRoomCounts();
      const withCounts = boards.map((b) => ({
        ...b,
        activeUsers: roomCounts.get(b.id) ?? 0,
      }));
      return json(withCounts);
    }

    if (pathname === "/api/boards" && req.method === "POST") {
      try {
        const body = (await req.json()) as { name?: string };
        const name = body.name?.trim();
        if (!name) {
          return json({ error: "Board name is required" }, 400);
        }
        const board = await createBoard(name);
        return json(board, 201);
      } catch {
        return json({ error: "Invalid request body" }, 400);
      }
    }

    const deleteMatch = pathname.match(/^\/api\/boards\/([a-f0-9-]+)$/);
    if (deleteMatch && req.method === "DELETE") {
      const deleted = await deleteBoard(deleteMatch[1]!);
      if (!deleted) {
        return json({ error: "Board not found" }, 404);
      }
      return json({ ok: true });
    }

    // --- Board editor page ---
    const boardMatch = pathname.match(/^\/board\/([a-f0-9-]+)$/);
    if (boardMatch) {
      const board = await getBoard(boardMatch[1]!);
      if (!board) {
        return json({ error: "Board not found" }, 404);
      }
      return serveStatic(join(PUBLIC_DIR, "board.html"));
    }

    // --- Static files ---
    if (pathname === "/" || pathname === "/index.html") {
      return serveStatic(join(PUBLIC_DIR, "index.html"));
    }

    // Serve other static files from public/ with path traversal protection
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    const resolved = resolve(PUBLIC_DIR, normalize(decoded).replace(/^\/+/, ""));
    if (!resolved.startsWith(PUBLIC_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }
    return serveStatic(resolved);
  },

  websocket: {
    open(ws) {
      addClient(ws);
    },
    message(ws, message) {
      handleMessage(ws, message);
    },
    close(ws) {
      removeClient(ws);
    },
  },
});

console.log(`Excalidraw Boards running on http://0.0.0.0:${server.port}`);
