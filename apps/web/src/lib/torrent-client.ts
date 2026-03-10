import WebTorrent from "webtorrent";
import type { Instance as WebTorrentInstance, Torrent, TorrentFile } from "webtorrent";
import { rtcConfig } from "./rtc-config.js";

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

export function initTorrentClient(): WebTorrentInstance {
  if (client) return client;

  // Configure simple-peer's default RTC config (STUN servers) before creating client.
  // WebTorrent uses @thaunknown/simple-peer internally for all WebRTC connections.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- simple-peer config override
  try {
    // Dynamic import of simple-peer to set config globally
    const Peer = (WebTorrent as unknown as { Peer?: { config?: RTCConfiguration } }).Peer;
    if (Peer) {
      Peer.config = rtcConfig;
    }
  } catch {
    // Fallback: simple-peer uses its own defaults (Google STUN)
  }

  client = new WebTorrent();

  client.on("error", (err) => {
    if (import.meta.env.DEV) console.error("[torrent-client] Error:", err);
  });

  return client;
}

export function destroyTorrentClient(): void {
  if (!client) return;
  client.destroy();
  client = null;
}

// ── Seeding ─────────────────────────────────────────────────────────────────

export function seedFile(file: File): Promise<SeedResult> {
  const c = initTorrentClient();

  return new Promise((resolve, reject) => {
    const onError = (err: Error | string) => reject(typeof err === "string" ? new Error(err) : err);
    c.once("error", onError);

    c.seed(file, (torrent: Torrent) => {
      c.removeListener("error", onError);
      torrent.once("error", (err) => reject(typeof err === "string" ? new Error(err) : err));
      resolve({
        magnetUri: torrent.magnetURI,
        infoHash: torrent.infoHash,
      });
    });
  });
}

// ── Downloading ─────────────────────────────────────────────────────────────

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export function downloadFromMagnet(
  magnetUri: string,
  onProgress?: ProgressCallback,
): Promise<File[]> {
  const c = initTorrentClient();

  return new Promise((resolve, reject) => {
    const torrent = c.add(magnetUri);

    const timeout = setTimeout(() => {
      torrent.destroy();
      reject(new Error("Download timed out after 5 minutes"));
    }, DOWNLOAD_TIMEOUT_MS);

    torrent.on("error", (err) => {
      clearTimeout(timeout);
      reject(typeof err === "string" ? new Error(err) : err);
    });

    if (onProgress) {
      torrent.on("download", () => {
        onProgress(torrent.progress, torrent.downloadSpeed);
      });
    }

    torrent.on("done", () => {
      clearTimeout(timeout);
      const filePromises = torrent.files.map(
        (f: TorrentFile) =>
          new Promise<File>((res, rej) => {
            f.getBlob((err, blob) => {
              if (err) {
                rej(typeof err === "string" ? new Error(err) : err);
                return;
              }
              if (!blob) {
                rej(new Error(`Failed to get blob for ${f.name}`));
                return;
              }
              res(new File([blob], f.name, { type: blob.type }));
            });
          }),
      );

      Promise.all(filePromises).then(resolve, reject);
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
