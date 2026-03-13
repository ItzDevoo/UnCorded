import { api, ApiRequestError } from "./api.js";

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

interface CloudflareTurnResponse {
  iceServers: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
}

let cachedTurn: CloudflareTurnResponse["iceServers"] | null = null;
let cachedExpiry = 0;

const TURN_TTL = 86_400; // Cloudflare credentials last 24 hours
const REFRESH_MARGIN = 60 * 60; // refresh 1 hour before expiry

export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedTurn && now < cachedExpiry - REFRESH_MARGIN) {
    return cachedTurn;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const data = await api<CloudflareTurnResponse>("/api/turn/credentials", {
      signal: controller.signal,
    });
    cachedTurn = data.iceServers;
    cachedExpiry = now + TURN_TTL;
    return cachedTurn;
  } catch (err) {
    // Auth/entitlement denial — respect it, clear stale cache
    if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
      cachedTurn = null;
      cachedExpiry = 0;
      return stunServers;
    }
    // Transient error — use cached credentials if still valid
    if (cachedTurn && now < cachedExpiry) {
      return cachedTurn;
    }
    return stunServers;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearTurnCredentialsCache(): void {
  cachedTurn = null;
  cachedExpiry = 0;
}
