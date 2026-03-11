import { redis } from "./redis.js";

// ── Channel names ───────────────────────────────────────────────────────────

export const PubSubChannel = {
  SERVER_MEMBERS: "cache:server-members",
  CHANNELS: "cache:channels",
  DM_MEMBERS: "cache:dm-members",
} as const;

type PubSubChannelName = (typeof PubSubChannel)[keyof typeof PubSubChannel];

// ── Publish (fire-and-forget) ───────────────────────────────────────────────

export function publishCacheInvalidation(channel: PubSubChannelName, payload: object): void {
  if (!redis) return; // No-op without Redis

  redis.publish(channel, JSON.stringify(payload)).catch((err) => {
    console.error(`[redis-pubsub] Failed to publish to ${channel}:`, err);
  });
}

// ── Subscribe (for future multi-instance work) ─────────────────────────────

export function subscribeCacheInvalidation(
  _channel: PubSubChannelName,
  _handler: (payload: object) => void,
): void {
  if (!redis) return; // No-op without Redis

  // Subscriber side not yet implemented — requires a second Redis connection
  // (Upstash REST-based pub/sub uses polling or a dedicated subscriber client).
  // This is intentionally left as a no-op until multi-instance deployment.
}
