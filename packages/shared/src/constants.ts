export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MESSAGE_PAGE_LIMIT = 50;
export const MESSAGE_FETCH_MAX_LIMIT = 100;

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
