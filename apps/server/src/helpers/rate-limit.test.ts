/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = { eval: vi.fn() };
  return { mockRedis };
});

vi.mock("../lib/redis.js", () => ({ redis: mockRedis }));

import { checkUserRateLimit } from "./rate-limit.js";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("checkUserRateLimit (Redis path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows requests within limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await expect(checkUserRateLimit("user_1", "messages", 5, 10_000)).resolves.toBeUndefined();
  });

  it("throws RateLimitError when Redis count exceeds limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(6);
    await expect(checkUserRateLimit("user_1", "messages", 5, 10_000)).rejects.toThrow();
  });

  it("passes correct Redis key and TTL", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await checkUserRateLimit("user_1", "messages", 5, 30_000);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      1,
      "rl:http:user_1:messages",
      30, // 30_000ms → 30s
    );
  });

  it("allows exactly at the limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(5);
    await expect(checkUserRateLimit("user_1", "messages", 5, 10_000)).resolves.toBeUndefined();
  });

  it("falls back to in-memory on Redis error", async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error("Redis connection lost"));
    // First call should succeed (in-memory fallback, count = 1)
    await expect(checkUserRateLimit("user_1", "fallback", 5, 10_000)).resolves.toBeUndefined();
  });
});
