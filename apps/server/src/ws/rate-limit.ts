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
  const redisKey = `rl:ws:${key}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  try {
    const count = (await redis!.eval(
      "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return c",
      1,
      redisKey,
      ttlSeconds,
    )) as number;
    return count <= limit;
  } catch {
    return checkInMemory(key, limit, windowMs);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether a user+opcode combination is within rate limits.
 * Returns `true` if allowed, `false` if rate-limited.
 */
export async function checkRateLimit(
  userId: string,
  opcode: number,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const key = `${userId}:${opcode}`;

  if (redis) {
    return checkViaRedis(key, limit, windowMs);
  }

  return checkInMemory(key, limit, windowMs);
}
