/* oxlint-disable eslint(no-shadow) -- vi.hoisted destructuring pattern */
import { afterAll, describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { selectResults, mockDb, capturedUpdates, originalBun } = vi.hoisted(() => {
  // Mock Bun.CryptoHasher (not available in Vitest's Node runtime)
  const originalBun = globalThis.Bun;
  const mockDigest = { digest: () => "mocked_hash" };
  globalThis.Bun = {
    CryptoHasher: function () {
      return { update: () => mockDigest };
    },
  } as never;

  const selectResults: unknown[][] = [];
  const capturedUpdates: unknown[] = [];

  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
          }),
        }),
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data: unknown) => {
        capturedUpdates.push(data);
        return {
          where: vi.fn().mockReturnValue({
            catch: vi.fn(),
          }),
        };
      }),
    })),
  };

  return { selectResults, capturedUpdates, mockDb, originalBun };
});

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("../db/index.js", () => ({ db: mockDb }));
vi.mock("../db/schema.js", () => ({
  bots: { userId: "bots.userId", tokenHash: "bots.tokenHash", id: "bots.id", lastUsedAt: "bots.lastUsedAt" },
  user: { id: "user.id" },
}));

import { getBotSession } from "./bot-auth.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function headers(auth?: string): Headers {
  const h = new Headers();
  if (auth) h.set("Authorization", auth);
  return h;
}

const fakeBot = { id: "bot_1", tokenHash: "abc", lastUsedAt: null };
const fakeUser = { id: "user_1", name: "bot-user", banned: false };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getBotSession", () => {
  afterAll(() => {
    globalThis.Bun = originalBun;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    capturedUpdates.length = 0;
  });

  it("returns null when no Authorization header", async () => {
    expect(await getBotSession(headers())).toBeNull();
  });

  it("returns null for non-bot Bearer tokens", async () => {
    expect(await getBotSession(headers("Bearer sk_regular_token"))).toBeNull();
  });

  it("returns null when no matching bot found", async () => {
    selectResults.push([]);
    expect(await getBotSession(headers("Bearer uncrd_test_token"))).toBeNull();
  });

  it("returns user and bot for valid token", async () => {
    selectResults.push([{ bots: fakeBot, user: fakeUser }]);
    const result = await getBotSession(headers("Bearer uncrd_test_token"));

    expect(result).toEqual({ user: fakeUser, bot: fakeBot });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("updates lastUsedAt when stale (>5 min)", async () => {
    const staleBot = { ...fakeBot, lastUsedAt: new Date(Date.now() - 6 * 60_000) };
    selectResults.push([{ bots: staleBot, user: fakeUser }]);

    await getBotSession(headers("Bearer uncrd_test_token"));

    expect(capturedUpdates).toHaveLength(1);
    expect(capturedUpdates[0]).toHaveProperty("lastUsedAt");
  });

  it("skips lastUsedAt update when recent (<5 min)", async () => {
    const freshBot = { ...fakeBot, lastUsedAt: new Date(Date.now() - 60_000) };
    selectResults.push([{ bots: freshBot, user: fakeUser }]);

    await getBotSession(headers("Bearer uncrd_test_token"));

    expect(capturedUpdates).toHaveLength(0);
  });
});
