import { createStore, produce } from "solid-js/store";
import { Opcode } from "@uncorded/protocol";
import type { AnyChannelId, FileReceiptId, UserId } from "@uncorded/protocol";
import {
  channelId,
  fileReceiptId,
  userId,
  fileShareEventSchema,
  fileAvailabilityEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent, sendFrame } from "../lib/gateway.js";
import {
  seedFile,
  downloadFromMagnet,
  stopSeeding,
  type SeedResult,
} from "../lib/torrent-client.js";

const MAX_PREVIEW_CACHE = 50;

// ── Types ───────────────────────────────────────────────────────────────────

export interface FileReceipt {
  id: FileReceiptId;
  channelId: AnyChannelId;
  senderId: UserId;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
}

export interface TransferProgress {
  infoHash: string;
  fileName: string;
  progress: number;
  downloadSpeed: number;
  status: "seeding" | "downloading" | "done" | "cancelled" | "error";
  error?: string;
}

interface FileStoreState {
  /** channelId -> receipts */
  receipts: Record<string, FileReceipt[]>;
  /** infoHash -> transfer progress */
  transfers: Record<string, TransferProgress>;
  /** fileReceiptId -> userId[] (active seeders) */
  seeders: Record<string, string[]>;
  /** infoHash -> cached File[] from preview/seed */
  previews: Record<string, File[]>;
  /** LRU order for preview cache (oldest first) */
  previewOrder: string[];
}

// ── Store ───────────────────────────────────────────────────────────────────

const [store, setStore] = createStore<FileStoreState>({
  receipts: {},
  transfers: {},
  seeders: {},
  previews: {},
  previewOrder: [],
});

// ── Internal helpers ────────────────────────────────────────────────────────

function addReceipt(receipt: FileReceipt): void {
  const key = receipt.channelId as string;
  if (!store.receipts[key]) {
    setStore("receipts", key, [receipt]);
    return;
  }
  setStore(
    "receipts",
    key,
    produce((arr) => {
      if (arr.some((r) => r.id === receipt.id)) return;
      arr.push(receipt);
    }),
  );
}

function updateSeeders(frId: FileReceiptId, uId: UserId, available: boolean): void {
  const key = frId as string;
  const uid = uId as string;

  if (!store.seeders[key]) {
    if (available) {
      setStore("seeders", key, [uid]);
    }
    return;
  }

  setStore(
    "seeders",
    key,
    produce((arr) => {
      const idx = arr.indexOf(uid);
      if (available && idx === -1) {
        arr.push(uid);
      } else if (!available && idx !== -1) {
        arr.splice(idx, 1);
      }
    }),
  );
}

function touchPreviewLru(infoHash: string): void {
  setStore(
    "previewOrder",
    produce((order) => {
      const idx = order.indexOf(infoHash);
      if (idx !== -1) order.splice(idx, 1);
      order.push(infoHash);
      while (order.length > MAX_PREVIEW_CACHE) {
        const evicted = order.shift()!;
        setStore("previews", evicted, undefined!);
      }
    }),
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractInfoHash(magnetUri: string): string {
  const hashMatch = magnetUri.match(/xt=urn:btih:([A-Fa-f0-9]{40}|[A-Za-z2-7]{32})/);
  return hashMatch?.[1] ?? magnetUri;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function shareFile(chId: AnyChannelId, file: File): Promise<SeedResult> {
  let result: SeedResult;
  try {
    result = await seedFile(file);
  } catch (err) {
    if (import.meta.env.DEV) console.error("[file-store] Failed to seed file:", err);
    throw err;
  }

  // Update transfer state
  setStore("transfers", result.infoHash, {
    infoHash: result.infoHash,
    fileName: file.name,
    progress: 1,
    downloadSpeed: 0,
    status: "seeding",
  });

  // Cache original file for instant sender preview
  setStore("previews", result.infoHash, [file]);
  touchPreviewLru(result.infoHash);

  // Send FILE_SHARE frame to server
  sendFrame({
    op: Opcode.FILE_SHARE,
    d: {
      channelId: chId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
      magnetUri: result.magnetUri,
      infoHash: result.infoHash,
    },
  });

  return result;
}

const inFlightPreviews = new Map<string, Promise<File[]>>();

/** Fetch file via WebTorrent into memory (no browser save). */
export async function previewFile(magnetUri: string, fileName: string): Promise<File[]> {
  const infoHash = extractInfoHash(magnetUri);

  // Return cached files if already previewed
  const cached = store.previews[infoHash];
  if (cached) {
    touchPreviewLru(infoHash);
    return cached;
  }

  // Dedupe concurrent requests for the same infoHash
  const inFlight = inFlightPreviews.get(infoHash);
  if (inFlight) return inFlight;

  const promise = (async () => {
    setStore("transfers", infoHash, {
      infoHash,
      fileName,
      progress: 0,
      downloadSpeed: 0,
      status: "downloading",
    });

    try {
      const files = await downloadFromMagnet(magnetUri, (progress, downloadSpeed) => {
        setStore("transfers", infoHash, {
          infoHash,
          fileName,
          progress,
          downloadSpeed,
          status: "downloading",
        });
      });

      setStore("transfers", infoHash, "status", "done");
      setStore("transfers", infoHash, "progress", 1);
      setStore("previews", infoHash, files);
      touchPreviewLru(infoHash);

      return files;
    } catch (err) {
      setStore("transfers", infoHash, "status", "error");
      setStore("transfers", infoHash, "error", String(err));
      if (import.meta.env.DEV) console.error("[file-store] Preview failed:", err);
      throw err;
    }
  })();

  inFlightPreviews.set(infoHash, promise);
  try {
    return await promise;
  } finally {
    inFlightPreviews.delete(infoHash);
  }
}

/** Trigger browser save from cached preview. */
export function saveFile(infoHash: string): void {
  const files = store.previews[infoHash];
  if (!files) {
    if (import.meta.env.DEV) console.warn("[file-store] No cached files for", infoHash);
    return;
  }

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Convenience: preview + save in one call. */
export async function downloadFile(magnetUri: string, fileName: string): Promise<File[]> {
  const files = await previewFile(magnetUri, fileName);
  const infoHash = extractInfoHash(magnetUri);
  saveFile(infoHash);
  return files;
}

export function cancelTransfer(infoHash: string): void {
  stopSeeding(infoHash);
  setStore("transfers", infoHash, "status", "cancelled");
}

export function getReceipts(chId: AnyChannelId): FileReceipt[] {
  return store.receipts[chId as string] ?? [];
}

export function getTransferProgress(infoHash: string): TransferProgress | undefined {
  return store.transfers[infoHash];
}

export function getPreviews(infoHash: string): File[] | undefined {
  return store.previews[infoHash];
}

export function getSeeders(frId: FileReceiptId): string[] {
  return store.seeders[frId as string] ?? [];
}

// ── WS listener unsub refs ──────────────────────────────────────────────────

let unsubFileShare: (() => void) | null = null;
let unsubAvailability: (() => void) | null = null;

function teardown() {
  unsubFileShare?.();
  unsubAvailability?.();
  unsubFileShare = null;
  unsubAvailability = null;
}

export function setupFileStore(): void {
  // Guard against double-init (HMR or reconnect)
  teardown();

  unsubFileShare = onGatewayEvent(Opcode.FILE_SHARE, (data) => {
    const parsed = fileShareEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn("Invalid FILE_SHARE payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    addReceipt({
      id: fileReceiptId(d.fileReceiptId),
      channelId: channelId(d.channelId),
      senderId: userId(d.senderId),
      fileName: d.fileName,
      fileSize: d.fileSize,
      contentType: d.contentType,
      magnetUri: d.magnetUri,
      infoHash: d.infoHash,
    });
  });

  unsubAvailability = onGatewayEvent(Opcode.FILE_AVAILABILITY_UPDATE, (data) => {
    const parsed = fileAvailabilityEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV)
        console.warn("Invalid FILE_AVAILABILITY_UPDATE payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    updateSeeders(fileReceiptId(d.fileReceiptId), userId(d.userId), d.available);
  });
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
