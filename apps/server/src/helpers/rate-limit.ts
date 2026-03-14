import { RateLimitError } from "@uncorded/shared";
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

function checkInMemory(key: string, limit: number, windowMs: number): boolean {
  ensureSweep();
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}

// ── Redis implementation ────────────────────────────────────────────────────

async function checkViaRedis(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redisKey = `rl:http:${key}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  try {
    // Atomic INCR + conditional EXPIRE via Lua to prevent TTL-less keys
    const count = (await redis!.eval(
      "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return c",
      [redisKey],
      [ttlSeconds],
    )) as number;
    return count <= limit;
  } catch (err) {
    console.warn("[rate-limit] Redis error; falling back to in-memory limiter", {
      error: err instanceof Error ? err.message : String(err),
    });
    return checkInMemory(key, limit, windowMs);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check per-user rate limit on an HTTP endpoint.
 * Throws `RateLimitError` if the limit is exceeded.
 */
export async function checkUserRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const key = `${userId}:${endpoint}`;
  const allowed = redis
    ? await checkViaRedis(key, limit, windowMs)
    : checkInMemory(key, limit, windowMs);

  if (!allowed) {
    throw new RateLimitError();
  }
}
