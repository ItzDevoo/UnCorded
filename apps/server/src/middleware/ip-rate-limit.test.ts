/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/redis.js", () => ({ redis: null }));

import { checkIpRateLimit } from "./ip-rate-limit.js";

describe("checkIpRateLimit (in-memory)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows IPs within limit", async () => {
    expect(await checkIpRateLimit("10.0.0.1", 5, 10_000)).toBe(true);
  });

  it("blocks IPs exceeding limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkIpRateLimit("10.0.0.2", 5, 10_000);
    }
    expect(await checkIpRateLimit("10.0.0.2", 5, 10_000)).toBe(false);
  });

  it("resets after window expires", async () => {
    for (let i = 0; i < 5; i++) {
      await checkIpRateLimit("10.0.0.3", 5, 10_000);
    }
    expect(await checkIpRateLimit("10.0.0.3", 5, 10_000)).toBe(false);

    vi.advanceTimersByTime(10_001);

    expect(await checkIpRateLimit("10.0.0.3", 5, 10_000)).toBe(true);
  });

  it("uses separate buckets per IP", async () => {
    for (let i = 0; i < 3; i++) {
      await checkIpRateLimit("10.0.0.4", 3, 10_000);
    }
    expect(await checkIpRateLimit("10.0.0.4", 3, 10_000)).toBe(false);
    // Different IP should still be allowed
    expect(await checkIpRateLimit("10.0.0.5", 3, 10_000)).toBe(true);
  });

  it("allows exactly up to the limit", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkIpRateLimit("10.0.0.6", 10, 10_000)).toBe(true);
    }
    expect(await checkIpRateLimit("10.0.0.6", 10, 10_000)).toBe(false);
  });
});
