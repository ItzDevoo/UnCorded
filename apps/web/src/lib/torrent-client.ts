import WebTorrent from "webtorrent";
import type { Instance as WebTorrentInstance, Torrent } from "webtorrent";
import { rtcConfig, getIceServers } from "./rtc-config.js";

// Known-good WebSocket trackers for browser peer discovery.
// DHT/LSD are disabled (require UDP dgram, impossible in browsers),
// so trackers are the sole discovery mechanism.
const TRACKER_URLS = ["wss://tracker.openwebtorrent.com", "wss://tracker.webtorrent.dev"];

// ── Errors ──────────────────────────────────────────────────────────────────

export class TorrentTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Download timed out after ${timeoutMs / 60_000} minutes`);
    this.name = "TorrentTimeoutError";
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface SeedResult {
  magnetUri: string;
  infoHash: string;
}

export interface TorrentInfo {
  infoHash: string;
  magnetUri: string;
  name: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  done: boolean;
}

export type ProgressCallback = (progress: number, downloadSpeed: number) => void;

// ── Singleton ───────────────────────────────────────────────────────────────

let client: WebTorrentInstance | null = null;
let initPromise: Promise<WebTorrentInstance> | null = null;

function setPeerConfig(config: RTCConfiguration) {
  try {
    const Peer = (WebTorrent as unknown as { Peer?: { config?: RTCConfiguration } }).Peer;
    if (Peer) {
      Peer.config = config;
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[torrent] Failed to configure simple-peer:", err);
  }
}

export async function initTorrentClient(): Promise<WebTorrentInstance> {
  if (client) {
    // Refresh is cheap — getIceServers() returns cached until TTL expires
    try {
      setPeerConfig({ iceServers: await getIceServers() });
    } catch {
      setPeerConfig(rtcConfig);
    }
    return client;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const iceServers = await getIceServers();
      setPeerConfig({ iceServers });
    } catch {
      setPeerConfig(rtcConfig);
    }

    client = new WebTorrent({ dht: false, lsd: false });

    client.on("error", (err) => {
      if (import.meta.env.DEV) console.error("[torrent-client] Error:", err);
    });

    return client;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function destroyTorrentClient(): void {
  if (!client) return;
  client.destroy();
  client = null;
  initPromise = null;
}

// ── Seeding ─────────────────────────────────────────────────────────────────

export async function seedFile(file: File): Promise<SeedResult> {
  const c = await initTorrentClient();

  return new Promise((resolve, reject) => {
    const onError = (err: Error | string) => reject(typeof err === "string" ? new Error(err) : err);
    c.once("error", onError);

    c.seed(file, { announce: TRACKER_URLS }, (torrent: Torrent) => {
      c.removeListener("error", onError);
      resolve({
        magnetUri: torrent.magnetURI,
        infoHash: torrent.infoHash,
      });
      // Long-lived seeding torrent — log errors in dev but don't crash
      torrent.on("error", (err) => {
        if (import.meta.env.DEV) console.warn("[torrent] Post-seed error:", err);
      });
    });
  });
}

// ── Downloading ─────────────────────────────────────────────────────────────

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export async function downloadFromMagnet(
  magnetUri: string,
  onProgress?: ProgressCallback,
): Promise<File[]> {
  const c = await initTorrentClient();

  return new Promise((resolve, reject) => {
    const torrent = c.add(magnetUri, { announce: TRACKER_URLS });

    const timeout = setTimeout(() => {
      torrent.destroy();
      reject(new TorrentTimeoutError(DOWNLOAD_TIMEOUT_MS));
    }, DOWNLOAD_TIMEOUT_MS);

    torrent.on("error", (err) => {
      clearTimeout(timeout);
      torrent.destroy();
      reject(typeof err === "string" ? new Error(err) : err);
    });

    if (onProgress) {
      torrent.on("download", () => {
        onProgress(torrent.progress, torrent.downloadSpeed);
      });
    }

    torrent.on("done", async () => {
      clearTimeout(timeout);
      try {
        const files = await Promise.all(
          torrent.files.map(async (f) => {
            const blob = await f.blob();
            return new File([blob], f.name, { type: blob.type });
          }),
        );
        resolve(files);
        torrent.destroy();
      } catch (err) {
        torrent.destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

// ── Management ──────────────────────────────────────────────────────────────

export function stopSeeding(infoHash: string): void {
  if (!client) return;
  const torrent = client.torrents.find((t) => t.infoHash === infoHash);
  if (torrent) {
    torrent.destroy();
  }
}

export function getActiveTorrents(): TorrentInfo[] {
  if (!client) return [];
  return client.torrents.map((t) => ({
    infoHash: t.infoHash,
    magnetUri: t.magnetURI,
    name: t.name,
    progress: t.progress,
    downloadSpeed: t.downloadSpeed,
    uploadSpeed: t.uploadSpeed,
    numPeers: t.numPeers,
    done: t.done,
  }));
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyTorrentClient();
  });
}
