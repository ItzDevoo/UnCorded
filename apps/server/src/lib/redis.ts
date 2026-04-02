import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;
let subscriber: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

  redis.on("ready", () => console.log("[redis] Command connection ready"));
  redis.on("error", (err) => console.error("[redis] Command connection error:", err.message));

  subscriber.on("ready", () => console.log("[redis] Subscriber connection ready"));
  subscriber.on("error", (err) =>
    console.error("[redis] Subscriber connection error:", err.message),
  );

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await Promise.all([redis?.quit(), subscriber?.quit()]);
      console.log("[redis] Connections closed");
    } catch {
      redis?.disconnect();
      subscriber?.disconnect();
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  console.log("[redis] Redis not configured — using in-memory fallback");
}

export function isRedisAvailable(): boolean {
  return redis !== null;
}

export { redis, subscriber };
