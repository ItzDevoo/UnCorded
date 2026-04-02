/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "@uncorded/shared";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = { eval: vi.fn() };
  return { mockRedis };
});

vi.mock("../lib/redis.js", () => ({ redis: mockRedis }));

import { checkUserRateLimit } from "./rate-limit.js";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("checkUserRateLimit (Redis path)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("allows requests within limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await expect(checkUserRateLimit("user_1", "messages", 5, 10_000)).resolves.toBeUndefined();
  });

  it("throws RateLimitError when Redis count exceeds limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(6);
    await expect(checkUserRateLimit("user_1", "messages", 5, 10_000)).rejects.toBeInstanceOf(
      RateLimitError,
    );
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

  it("falls back to in-memory on Redis error and enforces limit", async () => {
    // All Redis calls fail — in-memory fallback should still enforce the limit
    mockRedis.eval.mockRejectedValue(new Error("Redis connection lost"));

    for (let i = 0; i < 5; i++) {
      await expect(checkUserRateLimit("user_1", "fallback", 5, 10_000)).resolves.toBeUndefined();
    }
    // 6th call exceeds limit even via fallback
    await expect(checkUserRateLimit("user_1", "fallback", 5, 10_000)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });
});
