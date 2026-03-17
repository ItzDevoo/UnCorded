import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;
let subscriber: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

  redis.on("error", (err) => console.error("[redis] Command connection error:", err.message));
  subscriber.on("error", (err) => console.error("[redis] Subscriber connection error:", err.message));

  console.log("[redis] Connected to Redis via ioredis");
} else {
  console.log("[redis] Redis not configured — using in-memory fallback");
}

export function isRedisAvailable(): boolean {
  return redis !== null;
}

export { redis, subscriber };
