import { readFile, writeFile, mkdir, unlink, rename, readdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/app/data";
const BOARDS_DIR = join(DATA_DIR, "boards");

export interface BoardMeta {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
}

export interface BoardData {
  elements: unknown[];
  version?: number;
  appState?: Record<string, unknown>;
}

export interface ImageData {
  id: string;
  dataURL: string;
  mimeType: string;
}

// Simple async mutex to serialize index read-modify-write
let lockPromise: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lockPromise;
  let resolve: () => void;
  lockPromise = new Promise<void>((r) => {
    resolve = r;
  });
  return prev.then(fn).finally(() => resolve!());
}

async function ensureDir(): Promise<void> {
  await mkdir(BOARDS_DIR, { recursive: true });
}

function indexPath(): string {
  return join(BOARDS_DIR, "index.json");
}

function boardPath(id: string): string {
  return join(BOARDS_DIR, `${id}.json`);
}

function imagesDir(boardId: string): string {
  return join(BOARDS_DIR, boardId, "images");
}

async function readIndex(): Promise<BoardMeta[]> {
  try {
    const raw = await readFile(indexPath(), "utf-8");
    return JSON.parse(raw) as BoardMeta[];
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw new Error(`Failed to read board index: ${err}`);
  }
}

async function writeIndexAtomic(boards: BoardMeta[]): Promise<void> {
  await ensureDir();
  const tmpPath = indexPath() + ".tmp";
  await writeFile(tmpPath, JSON.stringify(boards, null, 2));
  await rename(tmpPath, indexPath());
}

export async function listBoards(): Promise<BoardMeta[]> {
  return readIndex();
}

export async function createBoard(name: string): Promise<BoardMeta> {
  return withLock(async () => {
    await ensureDir();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const data: BoardData = { elements: [], version: 0 };
    await writeFile(boardPath(id), JSON.stringify(data));

    const meta: BoardMeta = { id, name, createdAt: now, lastModified: now };
    const boards = await readIndex();
    boards.push(meta);
    await writeIndexAtomic(boards);

    return meta;
  });
}

export async function getBoard(id: string): Promise<BoardData | null> {
  try {
    const raw = await readFile(boardPath(id), "utf-8");
    return JSON.parse(raw) as BoardData;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read board ${id}: ${err}`);
  }
}

export async function saveBoard(id: string, data: BoardData): Promise<void> {
  return withLock(async () => {
    await ensureDir();

    // Only overwrite if incoming version >= stored version
    const existing = await getBoard(id);
    if (existing && (existing.version ?? 0) > (data.version ?? 0)) {
      return; // Stale write — skip
    }

    await writeFile(boardPath(id), JSON.stringify(data));

    const boards = await readIndex();
    const entry = boards.find((b) => b.id === id);
    if (entry) {
      entry.lastModified = new Date().toISOString();
      await writeIndexAtomic(boards);
    }
  });
}

export async function deleteBoard(id: string): Promise<boolean> {
  return withLock(async () => {
    const boards = await readIndex();
    const idx = boards.findIndex((b) => b.id === id);
    if (idx === -1) return false;

    boards.splice(idx, 1);
    await writeIndexAtomic(boards);

    try {
      await unlink(boardPath(id));
    } catch {
      // Board file may not exist
    }

    return true;
  });
}

// ── Image storage ──────────────────────────────────────────────────────────

export async function saveImage(
  boardId: string,
  imageId: string,
  data: { dataURL: string; mimeType: string },
): Promise<void> {
  const dir = imagesDir(boardId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${imageId}.json`), JSON.stringify(data));
}

export async function getImage(
  boardId: string,
  imageId: string,
): Promise<ImageData | null> {
  try {
    const raw = await readFile(join(imagesDir(boardId), `${imageId}.json`), "utf-8");
    const data = JSON.parse(raw) as { dataURL: string; mimeType: string };
    return { id: imageId, ...data };
  } catch {
    return null;
  }
}

export async function getImages(boardId: string): Promise<ImageData[]> {
  const dir = imagesDir(boardId);
  try {
    const files = await readdir(dir);
    const images: ImageData[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const id = file.replace(".json", "");
      const img = await getImage(boardId, id);
      if (img) images.push(img);
    }
    return images;
  } catch {
    return [];
  }
}
