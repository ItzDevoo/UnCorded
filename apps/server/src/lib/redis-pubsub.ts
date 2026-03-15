import { redis } from "./redis.js";

// ── Instance ID (skip own events in subscriber) ─────────────────────────────

export const instanceId = crypto.randomUUID();

// ── Channel names ───────────────────────────────────────────────────────────

export const PubSubChannel = {
  SERVER_MEMBERS: "cache:server-members",
  CHANNELS: "cache:channels",
  DM_MEMBERS: "cache:dm-members",
} as const;

type PubSubChannelName = (typeof PubSubChannel)[keyof typeof PubSubChannel];

// ── Publish (fire-and-forget via RPUSH) ─────────────────────────────────────

export function publishCacheInvalidation(channel: PubSubChannelName, payload: object): void {
  if (!redis) return;

  redis.rpush(channel, JSON.stringify({ ...payload, instanceId })).catch((err) => {
    console.error(`[redis-pubsub] Failed to rpush to ${channel}:`, err);
  });
}

// ── Subscribe (poll via LPOP) ───────────────────────────────────────────────

export function subscribeCacheInvalidation(
  channel: PubSubChannelName,
  handler: (payload: Record<string, unknown>) => void,
): () => void {
  if (!redis) return () => {};

  // Re-entry guard: prevent overlapping drains if a poll takes >2s
  let draining = false;

  const timer = setInterval(async () => {
    if (draining) return;
    draining = true;
    try {
      // Drain all pending messages (sequential LPOP is intentional — order matters)
      let raw: string | null;
      /* oxlint-disable no-await-in-loop -- sequential drain by design */
      while ((raw = await redis!.lpop<string>(channel)) !== null) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          // Skip events published by this instance
          if (parsed.instanceId === instanceId) continue;
          handler(parsed);
        } catch {
          console.error(`[redis-pubsub] Failed to parse message from ${channel}:`, raw);
        }
      }
      /* oxlint-enable no-await-in-loop */
    } catch (err) {
      console.error(`[redis-pubsub] Failed to poll ${channel}:`, err);
    } finally {
      draining = false;
    }
  }, 2000);

  return () => clearInterval(timer);
}
