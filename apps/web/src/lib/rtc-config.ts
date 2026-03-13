import { api } from "./api.js";

const DEFAULT_STUN_SERVERS: string[] = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

function parseStunServers(): string[] {
  const raw = import.meta.env.VITE_STUN_SERVERS;
  if (!raw) return DEFAULT_STUN_SERVERS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed as string[];
    }
    if (import.meta.env.DEV)
      console.warn("VITE_STUN_SERVERS is not a string array, using defaults");
    return DEFAULT_STUN_SERVERS;
  } catch {
    if (import.meta.env.DEV) console.warn("Failed to parse VITE_STUN_SERVERS, using defaults");
    return DEFAULT_STUN_SERVERS;
  }
}

const stunServers: RTCIceServer[] = parseStunServers().map((url) => ({ urls: url }));

export const rtcConfig: RTCConfiguration = {
  iceServers: stunServers,
};

// ── TURN credential cache ────────────────────────────────────────────────────

interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

let cachedTurn: TurnCredentials | null = null;
let cachedExpiry = 0;

const REFRESH_MARGIN = 5 * 60; // refresh 5 minutes before TTL expires

export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedTurn && now < cachedExpiry - REFRESH_MARGIN) {
    return [
      ...stunServers,
      { urls: cachedTurn.urls, username: cachedTurn.username, credential: cachedTurn.credential },
    ];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const turn = await api<TurnCredentials>("/api/turn/credentials", {
      signal: controller.signal,
    });
    cachedTurn = turn;
    cachedExpiry = now + turn.ttl;
    return [
      ...stunServers,
      { urls: turn.urls, username: turn.username, credential: turn.credential },
    ];
  } catch {
    // 403 (free user), 503 (no TURN configured), timeout, or network error — fall back to STUN only
    return stunServers;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearTurnCredentialsCache(): void {
  cachedTurn = null;
  cachedExpiry = 0;
}
