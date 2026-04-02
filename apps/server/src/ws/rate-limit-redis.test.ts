/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = { eval: vi.fn() };
  return { mockRedis };
});

vi.mock("../lib/redis.js", () => ({ redis: mockRedis }));

import { checkRateLimit } from "./rate-limit.js";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("checkRateLimit WS (Redis path)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns true when within limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    expect(await checkRateLimit("user_1", 1, 10, 60_000)).toBe(true);
  });

  it("returns false when exceeding limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(11);
    expect(await checkRateLimit("user_1", 1, 10, 60_000)).toBe(false);
  });

  it("uses rl:ws: key prefix", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await checkRateLimit("user_1", 3, 10, 60_000);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      1,
      "rl:ws:user_1:3",
      60,
    );
  });

  it("falls back to in-memory on Redis error and enforces limit", async () => {
    // Use a unique user+opcode so the in-memory bucket doesn't collide with other tests
    mockRedis.eval.mockRejectedValue(new Error("timeout"));

    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit("user_fallback", 99, 10, 60_000)).toBe(true);
    }
    // 11th call exceeds limit even via fallback
    expect(await checkRateLimit("user_fallback", 99, 10, 60_000)).toBe(false);
  });

  it("returns true at exact limit boundary", async () => {
    mockRedis.eval.mockResolvedValueOnce(10);
    expect(await checkRateLimit("user_1", 1, 10, 60_000)).toBe(true);
  });
});
