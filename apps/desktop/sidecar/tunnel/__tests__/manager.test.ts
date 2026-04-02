import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockSpawn, mockEnsureCloudflared, mockProcess } = vi.hoisted(() => {
  const hoistedProcess = {
    stderr: {
      on: vi.fn(),
    },
    stdout: {
      on: vi.fn(),
    },
    on: vi.fn(),
    kill: vi.fn(),
  };

  const hoistedSpawn = vi.fn().mockReturnValue(hoistedProcess);
  const hoistedEnsureCloudflared = vi.fn().mockResolvedValue("/usr/local/bin/cloudflared");

  return {
    mockSpawn: hoistedSpawn,
    mockEnsureCloudflared: hoistedEnsureCloudflared,
    mockProcess: hoistedProcess,
  };
});

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));
vi.mock("../binary", () => ({ ensureCloudflared: mockEnsureCloudflared }));

// ── Import after mocks ────────────────────────────────────────────────────

import { TunnelManager } from "../manager";

// ── Helpers ────────────────────────────────────────────────────────────────

function getStderrCallback(proc: typeof mockProcess): (data: Buffer) => void {
  const entry = proc.stderr.on.mock.calls.find((c: unknown[]) => c[0] === "data");
  expect(entry).toBeDefined();
  expect(typeof entry![1]).toBe("function");
  return entry![1] as (data: Buffer) => void;
}

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

      const stderrCallback = getStderrCallback(mockProcess);
      stderrCallback(Buffer.from("2026-01-01 INF | https://random-words.trycloudflare.com\n"));

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

      const stderrCallback = getStderrCallback(mockProcess);
      stderrCallback(Buffer.from("https://abc-def.trycloudflare.com"));

      await createPromise;
      expect(manager.getUrl("test-plugin")).toBe("https://abc-def.trycloudflare.com");
    });

    it("returns null for unknown plugin", () => {
      expect(manager.getUrl("nonexistent")).toBeNull();
    });

    it("rejects on startup timeout", async () => {
      const createPromise = manager.create("test-plugin", 3000);

      // Advance past the 30s timeout
      await vi.advanceTimersByTimeAsync(31_000);

      await expect(createPromise).rejects.toThrow("Tunnel startup timed out");
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(manager.getUrl("test-plugin")).toBeNull();
    });

    it("rejects on premature process exit", async () => {
      const createPromise = manager.create("test-plugin", 3000);

      // Simulate process exit before URL is found
      const exitCallback = mockProcess.on.mock.calls.find((c: unknown[]) => c[0] === "exit")?.[1];
      expect(exitCallback).toBeDefined();
      exitCallback(1);

      await expect(createPromise).rejects.toThrow("cloudflared exited with code 1");
      expect(manager.getUrl("test-plugin")).toBeNull();
    });

    it("rejects on spawn error", async () => {
      const createPromise = manager.create("test-plugin", 3000);

      // Simulate spawn error
      const errorCallback = mockProcess.on.mock.calls.find((c: unknown[]) => c[0] === "error")?.[1];
      expect(errorCallback).toBeDefined();
      errorCallback(new Error("ENOENT: cloudflared not found"));

      await expect(createPromise).rejects.toThrow("ENOENT: cloudflared not found");
      expect(manager.getUrl("test-plugin")).toBeNull();
    });
  });

  describe("destroy", () => {
    it("kills the tunnel process and waits for exit", async () => {
      // Set up a tunnel first
      const createPromise = manager.create("test-plugin", 3000);
      const stderrCallback = getStderrCallback(mockProcess);
      stderrCallback(Buffer.from("https://abc.trycloudflare.com"));
      await createPromise;

      // destroy calls kill() then waits for exit (or timeout)
      const destroyPromise = manager.destroy("test-plugin");

      // Advance past DESTROY_TIMEOUT_MS to let the wait resolve
      await vi.advanceTimersByTimeAsync(6_000);

      await destroyPromise;
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
      const stderrCb1 = getStderrCallback(mockProcess);
      stderrCb1(Buffer.from("https://a.trycloudflare.com"));
      await p1;

      // Save reference to first process's kill before clearing listener mocks
      const firstKill = mockProcess.kill;

      // Clear only listener mocks (not kill) for second spawn
      mockProcess.stderr.on.mockClear();
      mockProcess.stdout.on.mockClear();
      mockProcess.on.mockClear();

      const mockProcess2 = {
        stderr: { on: vi.fn() },
        stdout: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess2);

      const p2 = manager.create("plugin-2", 3002);
      const stderrCb2 = getStderrCallback(mockProcess2);
      stderrCb2(Buffer.from("https://b.trycloudflare.com"));
      await p2;

      const destroyPromise = manager.destroyAll();
      // Let destroy timeouts elapse
      await vi.advanceTimersByTimeAsync(6_000);
      await destroyPromise;

      expect(firstKill).toHaveBeenCalled();
      expect(mockProcess2.kill).toHaveBeenCalled();
      expect(manager.getUrl("plugin-1")).toBeNull();
      expect(manager.getUrl("plugin-2")).toBeNull();
    });
  });
});
