/* oxlint-disable eslint(no-shadow) -- vi.hoisted destructuring pattern */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockRequireMember,
  mockRequireOwner,
  mockComputeEffectiveTier,
  mockBroadcastToServer,
  selectResults,
  mockDb,
  deletedRows,
  insertedRow,
} = vi.hoisted(() => {
  const mockRequireMember = vi.fn().mockResolvedValue({});
  const mockRequireOwner = vi.fn().mockResolvedValue({ ownerId: "owner1" });
  const mockComputeEffectiveTier = vi.fn().mockResolvedValue("server_owner");
  const mockBroadcastToServer = vi.fn();

  const selectResults: unknown[][] = [];
  const deletedRows: unknown[][] = [];
  const insertedRow: unknown[] = [];

  /** Returns a chainable that supports both `await where(...)` and `where(...).limit(n)` */
  function makeWhereResult() {
    const resolve = () => selectResults.shift() ?? [];
    return {
      limit: vi.fn().mockImplementation(() => Promise.resolve(resolve())),
      // eslint-disable-next-line no-thenable
      then: (onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
  }

  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => makeWhereResult()),
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => makeWhereResult()),
        }),
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            const row = insertedRow.shift();
            return Promise.resolve(row ? [row] : []);
          }),
        }),
      }),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => Promise.resolve(deletedRows.shift() ?? [])),
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
        }),
      }),
    })),
  };

  return {
    mockRequireMember,
    mockRequireOwner,
    mockComputeEffectiveTier,
    mockBroadcastToServer,
    selectResults,
    mockDb,
    deletedRows,
    insertedRow,
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("../../db/index.js", () => ({ db: mockDb }));
vi.mock("../../db/schema.js", () => ({
  serverPlugins: {
    id: "server_plugins.id",
    serverId: "server_plugins.server_id",
    pluginId: "server_plugins.plugin_id",
    installedBy: "server_plugins.installed_by",
    tunnelUrl: "server_plugins.tunnel_url",
    state: "server_plugins.state",
  },
  pluginRegistry: {
    id: "plugin_registry.id",
    published: "plugin_registry.published",
    name: "plugin_registry.name",
    iconUrl: "plugin_registry.icon_url",
  },
}));
vi.mock("../../helpers/permissions.js", () => ({
  requireMember: mockRequireMember,
  requireOwner: mockRequireOwner,
}));
vi.mock("../../helpers/resolve-tier.js", () => ({
  computeEffectiveTier: mockComputeEffectiveTier,
}));
vi.mock("../../ws/connections.js", () => ({
  broadcastToServer: mockBroadcastToServer,
}));
vi.mock("@uncorded/protocol", () => ({
  Opcode: { SERVER_PLUGIN_STATE_UPDATE: 95 },
}));
vi.mock("../../middleware/auth.js", () => ({
  authResolve: () => () => ({ user: { id: "user1" }, session: {} }),
}));
vi.mock("../../middleware/ip-rate-limit.js", () => ({
  checkIpRateLimit: vi.fn().mockResolvedValue(true),
}));

// ── Import the Elysia instance (after mocks) ──────────────────────────────

import { Elysia } from "elysia";
import { AppError } from "@uncorded/shared";
import { serverPluginRoutes } from "../server-plugins.js";

// Wrap with error handler like the real app does
const app = new Elysia().use(serverPluginRoutes).onError(({ error, set }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode;
    return { code: error.code, message: error.message };
  }
  set.status = 500;
  return { code: "INTERNAL", message: "Internal server error" };
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, path: string, body?: unknown): Promise<Response> {
  const opts: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return app.handle(new Request(`http://localhost${path}`, opts));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("server plugin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    deletedRows.length = 0;
    insertedRow.length = 0;
    mockRequireMember.mockResolvedValue({});
    mockRequireOwner.mockResolvedValue({ ownerId: "owner1" });
    mockComputeEffectiveTier.mockResolvedValue("server_owner");
  });

  // ── GET /api/servers/:serverId/plugins ──────────────────────────────────

  describe("GET /api/servers/:serverId/plugins", () => {
    it("returns installed plugins for members", async () => {
      selectResults.push([
        {
          id: "sp1",
          pluginId: "claude-code",
          state: "active",
          tunnelUrl: "https://abc.trycloudflare.com",
          installedBy: "owner1",
          installedAt: new Date("2026-01-01"),
          config: null,
          name: "Claude Code",
          iconUrl: null,
        },
      ]);

      const res = await makeRequest("GET", "/api/servers/server1/plugins");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.plugins).toHaveLength(1);
      expect(data.plugins[0].pluginId).toBe("claude-code");
      expect(mockRequireMember).toHaveBeenCalledWith("user1", "server1");
    });

    it("calls requireMember for authorization", async () => {
      selectResults.push([]);
      await makeRequest("GET", "/api/servers/server1/plugins");
      expect(mockRequireMember).toHaveBeenCalledWith("user1", "server1");
    });
  });

  // ── POST /api/servers/:serverId/plugins ─────────────────────────────────

  describe("POST /api/servers/:serverId/plugins", () => {
    it("installs a plugin for server_owner tier users", async () => {
      // Registry lookup returns a published plugin
      selectResults.push([{ id: "claude-code" }]);

      insertedRow.push({
        id: "sp1",
        pluginId: "claude-code",
        serverId: "server1",
        state: "stopped",
      });

      const res = await makeRequest("POST", "/api/servers/server1/plugins", {
        pluginId: "claude-code",
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockRequireOwner).toHaveBeenCalledWith("user1", "server1");
    });

    it("rejects non-server_owner tier users", async () => {
      mockComputeEffectiveTier.mockResolvedValueOnce("supporter");

      const res = await makeRequest("POST", "/api/servers/server1/plugins", {
        pluginId: "claude-code",
      });
      // ForbiddenError → 403 in production (with global error handler)
      expect(res.ok).toBe(false);
    });

    it("rejects free tier users", async () => {
      mockComputeEffectiveTier.mockResolvedValueOnce("free");

      const res = await makeRequest("POST", "/api/servers/server1/plugins", {
        pluginId: "claude-code",
      });
      expect(res.ok).toBe(false);
    });
  });

  // ── DELETE /api/servers/:serverId/plugins/:pluginId ─────────────────────

  describe("DELETE /api/servers/:serverId/plugins/:pluginId", () => {
    it("uninstalls a plugin for the owner", async () => {
      deletedRows.push([{ id: "sp1" }]);

      const res = await makeRequest("DELETE", "/api/servers/server1/plugins/claude-code");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockRequireOwner).toHaveBeenCalledWith("user1", "server1");
    });

    it("returns error when plugin not found", async () => {
      deletedRows.push([]);

      const res = await makeRequest("DELETE", "/api/servers/server1/plugins/nonexistent");
      expect(res.ok).toBe(false);
    });
  });

  // ── PATCH /api/servers/:serverId/plugins/:pluginId ───────────────────────

  describe("PATCH /api/servers/:serverId/plugins/:pluginId", () => {
    it("updates config successfully", async () => {
      selectResults.push([
        {
          id: "sp1",
          pluginId: "claude-code",
          state: "stopped",
          config: '{"key":"val"}',
          tunnelUrl: null,
        },
      ]);
      selectResults.push([{ name: "Claude Code", iconUrl: null }]); // broadcast registry lookup

      const res = await makeRequest("PATCH", "/api/servers/server1/plugins/claude-code", {
        config: { key: "new-val" },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockRequireOwner).toHaveBeenCalledWith("user1", "server1");
    });

    it("updates state successfully and broadcasts", async () => {
      selectResults.push([
        { id: "sp1", pluginId: "claude-code", state: "active", tunnelUrl: null },
      ]);
      selectResults.push([{ name: "Claude Code", iconUrl: null }]); // broadcast registry lookup

      const res = await makeRequest("PATCH", "/api/servers/server1/plugins/claude-code", {
        state: "stopped",
      });
      expect(res.status).toBe(200);

      // Wait for fire-and-forget broadcast
      await new Promise((r) => setTimeout(r, 10));
      expect(mockBroadcastToServer).toHaveBeenCalledWith("server1", {
        op: 95,
        d: expect.objectContaining({
          serverId: "server1",
          pluginId: "claude-code",
          state: "active",
          name: "Claude Code",
        }),
      });
    });

    it("rejects empty update", async () => {
      const res = await makeRequest("PATCH", "/api/servers/server1/plugins/claude-code", {});
      expect(res.ok).toBe(false);
    });

    it("returns error when plugin not found", async () => {
      selectResults.push([]);

      const res = await makeRequest("PATCH", "/api/servers/server1/plugins/nonexistent", {
        state: "stopped",
      });
      expect(res.ok).toBe(false);
    });

    it("rejects invalid state value", async () => {
      const res = await makeRequest("PATCH", "/api/servers/server1/plugins/claude-code", {
        state: "invalid-state",
      });
      expect(res.ok).toBe(false);
    });
  });

  // ── GET /api/servers/:serverId/plugins/:pluginId/tunnel ─────────────────

  describe("GET /api/servers/:serverId/plugins/:pluginId/tunnel", () => {
    it("returns tunnel URL for members", async () => {
      selectResults.push([{ tunnelUrl: "https://abc.trycloudflare.com", state: "active" }]);

      const res = await makeRequest("GET", "/api/servers/server1/plugins/claude-code/tunnel");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tunnelUrl).toBe("https://abc.trycloudflare.com");
      expect(data.state).toBe("active");
    });

    it("returns error when plugin not found", async () => {
      selectResults.push([]);

      const res = await makeRequest("GET", "/api/servers/server1/plugins/nonexistent/tunnel");
      expect(res.ok).toBe(false);
    });
  });

  // ── PUT /api/servers/:serverId/plugins/:pluginId/tunnel ─────────────────

  describe("PUT /api/servers/:serverId/plugins/:pluginId/tunnel", () => {
    it("updates tunnel URL for the owner and broadcasts", async () => {
      selectResults.push([
        { id: "sp1", tunnelUrl: "https://new.trycloudflare.com", state: "active" },
      ]);
      selectResults.push([{ name: "Claude Code", iconUrl: null }]); // broadcast registry lookup

      const res = await makeRequest("PUT", "/api/servers/server1/plugins/claude-code/tunnel", {
        tunnelUrl: "https://new.trycloudflare.com",
        state: "active",
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockRequireOwner).toHaveBeenCalledWith("user1", "server1");

      // Wait for fire-and-forget broadcast
      await new Promise((r) => setTimeout(r, 10));
      expect(mockBroadcastToServer).toHaveBeenCalledWith("server1", {
        op: 95,
        d: expect.objectContaining({
          serverId: "server1",
          pluginId: "claude-code",
          state: "active",
          tunnelUrl: "https://new.trycloudflare.com",
          name: "Claude Code",
        }),
      });
    });
  });
});
