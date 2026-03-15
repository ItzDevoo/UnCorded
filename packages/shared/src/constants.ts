export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MESSAGE_PAGE_LIMIT = 50;
export const MESSAGE_FETCH_MAX_LIMIT = 100;
export const LIST_PAGE_LIMIT = 50;
export const LIST_FETCH_MAX_LIMIT = 100;

// ── Validation limits (server gateway + client pre-validation) ─────────────
export const MAX_SDP_SIZE = 16_384;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_CONTENT_TYPE_LENGTH = 127;
export const MAX_MAGNET_URI_LENGTH = 2_048;
export const MAX_INFO_HASH_LENGTH = 128;

// ── Heartbeat timing ───────────────────────────────────────────────────────
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_TIMEOUT_MS = 45_000;

// ── Channel limits ──────────────────────────────────────────────────────────
export const CHANNEL_NAME_MAX = 100;

// ── Typing indicator timing ────────────────────────────────────────────────
export const TYPING_THROTTLE_MS = 5_000;
/** Must exceed TYPING_THROTTLE_MS to prevent typing indicator flicker */
export const TYPING_TIMEOUT_MS = 6_000;

// ── WebSocket rate limits ────────────────────────────────────────────────
export const RATE_LIMIT_TYPING_START = { limit: 5, windowMs: 10_000 };
export const RATE_LIMIT_FILE_SHARE = { limit: 10, windowMs: 60_000 };
export const RATE_LIMIT_FILE_AVAILABILITY = { limit: 20, windowMs: 60_000 };
export const RATE_LIMIT_WEBRTC = { limit: 30, windowMs: 60_000 };
export const RATE_LIMIT_PRESENCE_UPDATE = { limit: 5, windowMs: 30_000 };

// ── HTTP rate limits ──────────────────────────────────────────────────────
export const RATE_LIMIT_MESSAGE_CREATE = { limit: 5, windowMs: 5_000 };
export const RATE_LIMIT_FRIEND_REQUEST = { limit: 10, windowMs: 60_000 };

// ── Resource creation limits ─────────────────────────────────────────────────
export const MAX_SERVERS_PER_USER = 100;
export const MAX_CHANNELS_PER_SERVER = 500;
export const MAX_INVITES_PER_SERVER = 50;

// ── Presence timing ────────────────────────────────────────────────────────
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── Avatar limits ───────────────────────────────────────────────────────────
export const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
export const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
