/* oxlint-disable eslint(no-shadow) -- vi.hoisted destructuring pattern */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (available to vi.mock factories) ─────────────────────────────

const { selectResults, mockDb } = vi.hoisted(() => {
  const selectResults: unknown[][] = [];

  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
        }),
      }),
    })),
  };

  return { selectResults, mockDb };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  members: { userId: "userId", serverId: "serverId" },
  servers: { id: "id", ownerId: "ownerId" },
}));

vi.mock("../../db/index.js", () => ({ db: mockDb }));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { requireMember, requireOwner, isMember } from "../permissions.js";
import { ForbiddenError, NotFoundError } from "@uncorded/shared";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("requireMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("returns member when user is a member", async () => {
    selectResults.push([{ userId: "u1", serverId: "s1", role: "member" }]);
    const result = await requireMember("u1", "s1");
    expect(result).toEqual({ userId: "u1", serverId: "s1", role: "member" });
  });

  it("throws ForbiddenError when not a member", async () => {
    selectResults.push([]);
    await expect(requireMember("u1", "s1")).rejects.toThrow(ForbiddenError);
  });
});

describe("requireOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("returns server when user is owner", async () => {
    selectResults.push([{ id: "s1", ownerId: "u1", name: "My Server" }]);
    const result = await requireOwner("u1", "s1");
    expect(result).toEqual({ id: "s1", ownerId: "u1", name: "My Server" });
  });

  it("throws NotFoundError when server does not exist", async () => {
    selectResults.push([]);
    await expect(requireOwner("u1", "s1")).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when user is not the owner", async () => {
    selectResults.push([{ id: "s1", ownerId: "other_user", name: "Their Server" }]);
    await expect(requireOwner("u1", "s1")).rejects.toThrow(ForbiddenError);
  });
});

describe("isMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("returns true when user is a member", async () => {
    selectResults.push([{ userId: "u1" }]);
    expect(await isMember("u1", "s1")).toBe(true);
  });

  it("returns false when user is not a member", async () => {
    selectResults.push([]);
    expect(await isMember("u1", "s1")).toBe(false);
  });
});
