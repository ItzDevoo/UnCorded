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

// ── Dev mode check ──────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === "development" || import.meta.env.DEV;

// ── Publish (fire-and-forget via RPUSH) ─────────────────────────────────────

export function publishCacheInvalidation(channel: PubSubChannelName, payload: object): void {
  if (!redis || isDev) return;

  redis.rpush(channel, JSON.stringify({ ...payload, instanceId })).catch((err) => {
    console.error(`[redis-pubsub] Failed to rpush to ${channel}:`, err);
  });
}

// ── Subscribe (poll via LPOP) ───────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30s — balances freshness vs Upstash command usage

export function subscribeCacheInvalidation(
  channel: PubSubChannelName,
  handler: (payload: Record<string, unknown>) => void,
): () => void {
  // Skip polling in dev — single instance doesn't need cross-instance cache sync
  if (!redis || isDev) return () => {};

  // Re-entry guard: prevent overlapping drains if a poll takes longer than interval
  let draining = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (draining || stopped) return;
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
      const msg = err instanceof Error ? err.message : String(err);
      // Stop polling if Upstash rate limit is hit — in-memory caches still work
      if (msg.includes("max requests limit exceeded")) {
        console.warn(`[redis-pubsub] Upstash limit reached — disabling polling for ${channel}`);
        stopped = true;
        clearInterval(timer);
        return;
      }
      console.error(`[redis-pubsub] Failed to poll ${channel}:`, err);
    } finally {
      draining = false;
    }
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
