import { redis, subscriber } from "./redis.js";

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

// ── Handler registry ────────────────────────────────────────────────────────

const handlers = new Map<string, (payload: Record<string, unknown>) => void>();
let listenerAttached = false;

function ensureMessageListener(): void {
  if (listenerAttached || !subscriber) return;
  listenerAttached = true;

  subscriber.on("message", (channel: string, message: string) => {
    const handler = handlers.get(channel);
    if (!handler) return;

    try {
      const parsed = JSON.parse(message) as Record<string, unknown>;
      // Skip events published by this instance
      if (parsed.instanceId === instanceId) return;
      handler(parsed);
    } catch {
      console.error(`[redis-pubsub] Failed to parse message from ${channel}:`, message);
    }
  });
}

// ── Publish (native PUBLISH) ────────────────────────────────────────────────

export function publishCacheInvalidation(channel: PubSubChannelName, payload: object): void {
  // Local handler already ran at the call site — publish is for other instances.
  if (!redis || isDev) return;

  redis.publish(channel, JSON.stringify({ ...payload, instanceId })).catch((err: Error) => {
    console.error(
      `[redis-pubsub] Failed to publish to ${channel} — other instances may serve stale data`,
      { error: err.message, channel, payload },
    );
  });
}

// ── Subscribe (native SUBSCRIBE) ────────────────────────────────────────────

export function subscribeCacheInvalidation(
  channel: PubSubChannelName,
  handler: (payload: Record<string, unknown>) => void,
): () => void {
  if (!subscriber || isDev) return () => {};

  ensureMessageListener();
  handlers.set(channel, handler);

  subscriber.subscribe(channel).catch((err: Error) => {
    console.error(`[redis-pubsub] Failed to subscribe to ${channel}:`, err);
  });

  return () => {
    handlers.delete(channel);
    subscriber!.unsubscribe(channel).catch(() => {});
  };
}
