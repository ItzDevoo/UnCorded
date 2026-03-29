import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockSpawn, mockEnsureCloudflared, mockProcess } = vi.hoisted(() => {
  const mockProcess = {
    stderr: {
      on: vi.fn(),
    },
    stdout: {
      on: vi.fn(),
    },
    on: vi.fn(),
    kill: vi.fn(),
  };

  const mockSpawn = vi.fn().mockReturnValue(mockProcess);
  const mockEnsureCloudflared = vi.fn().mockResolvedValue("/usr/local/bin/cloudflared");

  return { mockSpawn, mockEnsureCloudflared, mockProcess };
});

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));
vi.mock("../binary", () => ({ ensureCloudflared: mockEnsureCloudflared }));

// ── Import after mocks ────────────────────────────────────────────────────

import { TunnelManager } from "../manager";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("TunnelManager", () => {
  let manager: TunnelManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = new TunnelManager("/tmp/test-data");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("spawns cloudflared and resolves with tunnel URL", async () => {
      const createPromise = manager.create("test-plugin", 3000);

      // Simulate cloudflared output on stderr
      const stderrCallback = mockProcess.stderr.on.mock.calls.find(
        (c: unknown[]) => c[0] === "data",
      )?.[1];
      expect(stderrCallback).toBeDefined();

      stderrCallback(Buffer.from(
        "2026-01-01 INF | https://random-words.trycloudflare.com\n",
      ));

      const url = await createPromise;
      expect(url).toBe("https://random-words.trycloudflare.com");
      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/local/bin/cloudflared",
        ["tunnel", "--url", "http://localhost:3000", "--no-autoupdate"],
        expect.any(Object),
      );
    });

    it("returns the tunnel URL from getUrl after creation", async () => {
      const createPromise = manager.create("test-plugin", 3000);

      const stderrCallback = mockProcess.stderr.on.mock.calls.find(
        (c: unknown[]) => c[0] === "data",
      )?.[1];
      stderrCallback(Buffer.from("https://abc-def.trycloudflare.com"));

      await createPromise;
      expect(manager.getUrl("test-plugin")).toBe("https://abc-def.trycloudflare.com");
    });

    it("returns null for unknown plugin", () => {
      expect(manager.getUrl("nonexistent")).toBeNull();
    });
  });

  describe("destroy", () => {
    it("kills the tunnel process", async () => {
      // Set up a tunnel first
      const createPromise = manager.create("test-plugin", 3000);
      const stderrCallback = mockProcess.stderr.on.mock.calls.find(
        (c: unknown[]) => c[0] === "data",
      )?.[1];
      stderrCallback(Buffer.from("https://abc.trycloudflare.com"));
      await createPromise;

      await manager.destroy("test-plugin");
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(manager.getUrl("test-plugin")).toBeNull();
    });

    it("is a no-op for unknown plugin", async () => {
      await expect(manager.destroy("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("destroyAll", () => {
    it("cleans up all tunnels", async () => {
      // Create first tunnel
      const p1 = manager.create("plugin-1", 3001);
      let stderrCb = mockProcess.stderr.on.mock.calls.find(
        (c: unknown[]) => c[0] === "data",
      )?.[1];
      stderrCb(Buffer.from("https://a.trycloudflare.com"));
      await p1;

      // Reset mock for second spawn
      vi.clearAllMocks();
      const mockProcess2 = {
        stderr: { on: vi.fn() },
        stdout: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess2);

      const p2 = manager.create("plugin-2", 3002);
      stderrCb = mockProcess2.stderr.on.mock.calls.find(
        (c: unknown[]) => c[0] === "data",
      )?.[1];
      stderrCb(Buffer.from("https://b.trycloudflare.com"));
      await p2;

      await manager.destroyAll();
      expect(manager.getUrl("plugin-1")).toBeNull();
      expect(manager.getUrl("plugin-2")).toBeNull();
    });
  });
});
