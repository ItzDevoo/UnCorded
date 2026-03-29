import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
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
  appState?: Record<string, unknown>;
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

async function readIndex(): Promise<BoardMeta[]> {
  try {
    const raw = await readFile(indexPath(), "utf-8");
    return JSON.parse(raw) as BoardMeta[];
  } catch {
    return [];
  }
}

async function writeIndex(boards: BoardMeta[]): Promise<void> {
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(boards, null, 2));
}

export async function listBoards(): Promise<BoardMeta[]> {
  return readIndex();
}

export async function createBoard(name: string): Promise<BoardMeta> {
  await ensureDir();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meta: BoardMeta = { id, name, createdAt: now, lastModified: now };
  const boards = await readIndex();
  boards.push(meta);
  await writeIndex(boards);

  const data: BoardData = { elements: [] };
  await writeFile(boardPath(id), JSON.stringify(data));

  return meta;
}

export async function getBoard(id: string): Promise<BoardData | null> {
  try {
    const raw = await readFile(boardPath(id), "utf-8");
    return JSON.parse(raw) as BoardData;
  } catch {
    return null;
  }
}

export async function saveBoard(id: string, data: BoardData): Promise<void> {
  await ensureDir();
  await writeFile(boardPath(id), JSON.stringify(data));

  // Update lastModified in index
  const boards = await readIndex();
  const entry = boards.find((b) => b.id === id);
  if (entry) {
    entry.lastModified = new Date().toISOString();
    await writeIndex(boards);
  }
}

export async function deleteBoard(id: string): Promise<boolean> {
  const boards = await readIndex();
  const idx = boards.findIndex((b) => b.id === id);
  if (idx === -1) return false;

  boards.splice(idx, 1);
  await writeIndex(boards);

  try {
    await unlink(boardPath(id));
  } catch {
    // Board file may not exist
  }

  return true;
}
