import { Redis } from "@upstash/redis";
import { env } from "../env.js";

let redis: Redis | null = null;

if (env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN) {
  redis = new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  });
  console.log("[redis] Connected to Upstash Redis");
} else {
  console.log("[redis] Redis not configured — using in-memory fallback");
}

export function isRedisAvailable(): boolean {
  return redis !== null;
}

export { redis };
