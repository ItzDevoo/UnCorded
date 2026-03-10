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

export const rtcConfig: RTCConfiguration = {
  iceServers: parseStunServers().map((url) => ({ urls: url })),
};
