/* oxlint-disable eslint(no-await-in-loop) -- sequential calls required to test rate limiting */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/redis.js", () => ({ redis: null }));

import { checkRateLimit } from "./rate-limit.js";

describe("checkRateLimit (in-memory)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within limit", async () => {
    expect(await checkRateLimit("u1", 1, 5, 10_000)).toBe(true);
  });

  it("allows up to the exact limit", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit("u2", 2, 5, 10_000)).toBe(true);
    }
  });

  it("blocks requests exceeding limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("u3", 3, 5, 10_000);
    }
    expect(await checkRateLimit("u3", 3, 5, 10_000)).toBe(false);
  });

  it("resets after window expires", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("u4", 4, 5, 10_000);
    }
    expect(await checkRateLimit("u4", 4, 5, 10_000)).toBe(false);

    vi.advanceTimersByTime(10_001);

    expect(await checkRateLimit("u4", 4, 5, 10_000)).toBe(true);
  });

  it("uses separate buckets per opcode", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("u5", 10, 3, 10_000);
    }
    expect(await checkRateLimit("u5", 10, 3, 10_000)).toBe(false);
    // Different opcode should still be allowed
    expect(await checkRateLimit("u5", 20, 3, 10_000)).toBe(true);
  });

  it("uses separate buckets per user", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("u6", 5, 3, 10_000);
    }
    expect(await checkRateLimit("u6", 5, 3, 10_000)).toBe(false);
    // Different user should still be allowed
    expect(await checkRateLimit("u7", 5, 3, 10_000)).toBe(true);
  });
});
