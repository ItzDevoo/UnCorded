import { redis } from "../lib/redis.js";

// ── In-memory fallback ──────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now >= entry.resetAt) buckets.delete(key);
    }
  }, 60_000);
  sweepTimer.unref();
}

function checkInMemory(ip: string, limit: number, windowMs: number): boolean {
  ensureSweep();
  const now = Date.now();
  const entry = buckets.get(ip);

  if (!entry || now >= entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}

// ── Redis implementation ────────────────────────────────────────────────────

async function checkViaRedis(ip: string, limit: number, windowMs: number): Promise<boolean> {
  const redisKey = `rl:ip:${ip}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  try {
    const count = await redis!.incr(redisKey);
    if (count === 1) {
      await redis!.expire(redisKey, ttlSeconds);
    }
    return count <= limit;
  } catch {
    return checkInMemory(ip, limit, windowMs);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether an IP is within rate limits.
 * Returns `true` if allowed, `false` if rate-limited.
 */
export async function checkIpRateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (redis) {
    return checkViaRedis(ip, limit, windowMs);
  }

  return checkInMemory(ip, limit, windowMs);
}
