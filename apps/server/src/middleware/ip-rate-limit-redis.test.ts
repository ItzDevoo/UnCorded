/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = { eval: vi.fn() };
  return { mockRedis };
});

vi.mock("../lib/redis.js", () => ({ redis: mockRedis }));

import { checkIpRateLimit } from "./ip-rate-limit.js";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("checkIpRateLimit (Redis path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when within limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    expect(await checkIpRateLimit("10.0.0.1", 5, 10_000)).toBe(true);
  });

  it("returns false when exceeding limit", async () => {
    mockRedis.eval.mockResolvedValueOnce(6);
    expect(await checkIpRateLimit("10.0.0.1", 5, 10_000)).toBe(false);
  });

  it("uses correct Redis key with default prefix", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await checkIpRateLimit("10.0.0.1", 5, 10_000);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      1,
      "rl:ip:10.0.0.1",
      10,
    );
  });

  it("uses custom prefix when provided", async () => {
    mockRedis.eval.mockResolvedValueOnce(1);
    await checkIpRateLimit("10.0.0.1", 5, 10_000, "signup");

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      1,
      "rl:signup:10.0.0.1",
      10,
    );
  });

  it("falls back to in-memory on Redis error", async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error("connection refused"));
    expect(await checkIpRateLimit("10.0.0.1", 5, 10_000)).toBe(true);
  });
});
