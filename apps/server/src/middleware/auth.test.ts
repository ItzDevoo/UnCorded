/* oxlint-disable eslint(no-shadow) -- vi.hoisted destructuring pattern */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedError, ForbiddenError } from "@uncorded/shared";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockGetSession, mockGetBotSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetBotSession: vi.fn(),
}));

vi.mock("../auth/index.js", () => ({
  auth: {
    handler: () => new Response(),
    api: { getSession: mockGetSession },
  },
}));

vi.mock("./bot-auth.js", () => ({
  getBotSession: mockGetBotSession,
}));

import { authResolve, getSession } from "./auth.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function fakeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/test", headers ? { headers } : {});
}

const validUser = {
  id: "user_1",
  name: "alice",
  banned: false,
  subscriptionTier: "free",
};
const validSession = { id: "sess_1", userId: "user_1" };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to auth.api.getSession", async () => {
    mockGetSession.mockResolvedValueOnce({ user: validUser, session: validSession });
    const result = await getSession(new Headers());
    expect(mockGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(result).toEqual({ user: validUser, session: validSession });
  });

  it("returns null when no session exists", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await getSession(new Headers());
    expect(result).toBeNull();
  });
});

describe("authResolve", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("session auth", () => {
    it("returns user and session for valid session", async () => {
      mockGetSession.mockResolvedValueOnce({ user: validUser, session: validSession });
      const resolve = authResolve();
      const result = await resolve({ request: fakeRequest() });

      expect(result).toEqual({ user: validUser, session: validSession });
    });

    it("throws UnauthorizedError when no session and bots not allowed", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const resolve = authResolve();

      await expect(resolve({ request: fakeRequest() })).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws ForbiddenError for banned users", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { ...validUser, banned: true },
        session: validSession,
      });
      const resolve = authResolve();

      await expect(resolve({ request: fakeRequest() })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("bot auth fallback", () => {
    it("falls back to bot auth when allowBots is true and no session", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      mockGetBotSession.mockResolvedValueOnce({
        user: { ...validUser, isBot: true },
        bot: { id: "bot_1" },
      });
      const resolve = authResolve({ allowBots: true });
      const req = fakeRequest({ authorization: "Bearer uncrd_test" });
      const result = await resolve({ request: req });

      expect(result).toEqual({
        user: { ...validUser, isBot: true },
        session: null,
      });
      const passedHeaders = mockGetBotSession.mock.calls[0]![0] as Headers;
      expect(passedHeaders.get("authorization")).toBe("Bearer uncrd_test");
    });

    it("does not try bot auth when allowBots is false (default)", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const resolve = authResolve();

      await expect(resolve({ request: fakeRequest() })).rejects.toBeInstanceOf(UnauthorizedError);
      expect(mockGetBotSession).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError for banned bots", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      mockGetBotSession.mockResolvedValueOnce({
        user: { ...validUser, banned: true, isBot: true },
        bot: { id: "bot_1" },
      });
      const resolve = authResolve({ allowBots: true });

      await expect(resolve({ request: fakeRequest() })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws UnauthorizedError when bot auth also fails", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      mockGetBotSession.mockResolvedValueOnce(null);
      const resolve = authResolve({ allowBots: true });

      await expect(resolve({ request: fakeRequest() })).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
