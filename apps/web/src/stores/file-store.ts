import { createSignal } from "solid-js";
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
import { readyData } from "../lib/gateway-store.js";
import {
  seedFile,
  downloadFromMagnet,
  stopSeeding,
  getSeedingInfoHashes,
  type SeedResult,
} from "../lib/torrent-client.js";
import { computePdqHash } from "../lib/pdq-hash.js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";

const MAX_PREVIEW_CACHE = 10;
const P2P_ACK_KEY = "uncorded:p2p-ip-acknowledged";

// ── P2P IP disclosure dialog state ──────────────────────────────────────────

const [p2pDialogOpen, setP2pDialogOpen] = createSignal(false);
let p2pResolve: (() => void) | null = null;
let p2pReject: (() => void) | null = null;

export function getP2pDialogOpen(): boolean {
  return p2pDialogOpen();
}

export function confirmP2pDialog(): void {
  localStorage.setItem(P2P_ACK_KEY, "true");
  setP2pDialogOpen(false);
  p2pResolve?.();
  p2pResolve = null;
  p2pReject = null;
}

export function cancelP2pDialog(): void {
  setP2pDialogOpen(false);
  p2pReject?.();
  p2pResolve = null;
  p2pReject = null;
}

async function ensureP2pAcknowledged(): Promise<void> {
  if (localStorage.getItem(P2P_ACK_KEY) === "true") return;

  return new Promise<void>((resolve, reject) => {
    p2pResolve = resolve;
    p2pReject = reject;
    setP2pDialogOpen(true);
  });
}

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

/** Find all receipts matching an infoHash (across all channels). */
function findReceiptsByInfoHash(infoHash: string): FileReceipt[] {
  const results: FileReceipt[] = [];
  for (const key of Object.keys(store.receipts)) {
    for (const r of store.receipts[key] ?? []) {
      if (r.infoHash === infoHash) results.push(r);
    }
  }
  return results;
}

/** Broadcast availability=false for all files we're currently seeding. */
function broadcastSeedingOffline(): void {
  const seedingHashes = getSeedingInfoHashes();
  for (const infoHash of seedingHashes) {
    for (const receipt of findReceiptsByInfoHash(infoHash)) {
      sendFrame({
        op: Opcode.FILE_AVAILABILITY_UPDATE,
        d: {
          fileReceiptId: receipt.id as string,
          channelId: receipt.channelId as string,
          available: false,
        },
      });
    }
  }
}

/** Broadcast availability=true for a file we just downloaded (receiver becomes seeder). */
function broadcastReceiverHasFile(receipt: FileReceipt): void {
  sendFrame({
    op: Opcode.FILE_AVAILABILITY_UPDATE,
    d: {
      fileReceiptId: receipt.id as string,
      channelId: receipt.channelId as string,
      available: true,
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function shareFile(chId: AnyChannelId, file: File): Promise<SeedResult> {
  // P2P IP disclosure check (first share in session)
  await ensureP2pAcknowledged();

  // CSAM hash check for images
  const hash = await computePdqHash(file);
  if (hash !== null) {
    try {
      const res = await api<{ blocked: boolean }>("/api/safety/check-hash", {
        method: "POST",
        body: JSON.stringify({ hash }),
      });
      if (res.blocked) {
        showToast("This file cannot be shared", "error");
        throw new Error("File blocked by safety check");
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast("Safety check failed", "error");
        throw err;
      }
      // Re-throw "blocked" errors
      if (err instanceof Error && err.message === "File blocked by safety check") {
        throw err;
      }
      // Non-blocking: if safety service is down, allow file share to proceed
      if (import.meta.env.DEV) console.warn("[file-store] Safety check error:", err);
    }
  }

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

/** Fetch file via WebTorrent into memory (no browser save).
 *  If `receipt` is provided, broadcasts availability=true on success (receiver has the file). */
export async function previewFile(
  magnetUri: string,
  fileName: string,
  receipt?: FileReceipt,
): Promise<File[]> {
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

      // Receiver successfully downloaded — broadcast that we have the file
      if (receipt) {
        broadcastReceiverHasFile(receipt);
      }

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
export async function downloadFile(
  magnetUri: string,
  fileName: string,
  receipt?: FileReceipt,
): Promise<File[]> {
  const files = await previewFile(magnetUri, fileName, receipt);
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

function handleBeforeUnload(): void {
  broadcastSeedingOffline();
}

function teardown() {
  unsubFileShare?.();
  unsubAvailability?.();
  unsubFileShare = null;
  unsubAvailability = null;
  window.removeEventListener("beforeunload", handleBeforeUnload);
}

export function setupFileStore(): void {
  // Guard against double-init (HMR or reconnect)
  teardown();

  // Broadcast offline for all seeding files when the user closes the tab
  window.addEventListener("beforeunload", handleBeforeUnload);

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

    // If we're the sender and currently seeding this file, announce availability
    // so the receiver sees seederCount > 0 and can preview/download
    const currentUserId = readyData.data?.user.id;
    if (currentUserId && d.senderId === currentUserId) {
      const seedingHashes = getSeedingInfoHashes();
      if (seedingHashes.includes(d.infoHash)) {
        sendFrame({
          op: Opcode.FILE_AVAILABILITY_UPDATE,
          d: {
            fileReceiptId: d.fileReceiptId,
            channelId: d.channelId,
            available: true,
          },
        });
      }
    }
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
