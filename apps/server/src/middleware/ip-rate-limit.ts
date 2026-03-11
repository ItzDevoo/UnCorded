interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

const SWEEP_INTERVAL_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

/**
 * Check whether an IP is within rate limits.
 * Returns `true` if allowed, `false` if rate-limited.
 */
export function checkIpRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);

  if (!entry || now >= entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > limit) {
    return false;
  }

  return true;
}
