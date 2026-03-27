import { Elysia } from "elysia";
import { eq, and, sql, desc } from "drizzle-orm";
import { NotFoundError, RateLimitError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { pluginInstalls, bots, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Plugin Catalog (hardcoded for now) ──────────────────────────────────────

const PLUGIN_CATALOG = [
  {
    id: "claude-code",
    name: "Claude Code",
    description:
      "Connect your Claude Code session to UnCorded. Chat with Claude from any DM or server channel.",
    author: "UnCorded",
    icon: null,
    category: "AI",
    tags: ["ai", "developer-tools", "automation"],
  },
] as const;

function findPlugin(id: string) {
  return PLUGIN_CATALOG.find((p) => p.id === id);
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const pluginRoutes = new Elysia({ prefix: "/api/plugins" })
  .resolve(authResolve())

  // ── GET /api/plugins — list catalog with install counts + user status ──
  .get("/", async ({ user: sessionUser }) => {
    // Get install counts per plugin
    const countRows = await db
      .select({
        pluginId: pluginInstalls.pluginId,
        count: sql<number>`count(*)::int`,
      })
      .from(pluginInstalls)
      .groupBy(pluginInstalls.pluginId);

    const countMap = new Map(countRows.map((r) => [r.pluginId, r.count]));

    // Get user's installs
    const userInstalls = await db
      .select({
        pluginId: pluginInstalls.pluginId,
        installedAt: pluginInstalls.installedAt,
      })
      .from(pluginInstalls)
      .where(eq(pluginInstalls.userId, sessionUser.id));

    const userInstallMap = new Map(
      userInstalls.map((r) => [r.pluginId, r.installedAt]),
    );

    const plugins = PLUGIN_CATALOG.map((p) =>
      Object.assign({}, p, {
        installCount: countMap.get(p.id) ?? 0,
        installed: userInstallMap.has(p.id),
        installedAt: userInstallMap.get(p.id)?.toISOString() ?? null,
      }),
    );

    return { plugins };
  })

  // ── GET /api/plugins/:pluginId — detail with setup status ─────────────
  .get("/:pluginId", async ({ user: sessionUser, params }) => {
    const catalog = findPlugin(params.pluginId);
    if (!catalog) throw new NotFoundError("Plugin");

    // Install count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pluginInstalls)
      .where(eq(pluginInstalls.pluginId, params.pluginId));

    // User install
    const [userInstall] = await db
      .select({ installedAt: pluginInstalls.installedAt })
      .from(pluginInstalls)
      .where(
        and(
          eq(pluginInstalls.pluginId, params.pluginId),
          eq(pluginInstalls.userId, sessionUser.id),
        ),
      );

    const plugin = {
      ...catalog,
      installCount: countRow?.count ?? 0,
      installed: !!userInstall,
      installedAt: userInstall?.installedAt?.toISOString() ?? null,
    };

    // Build setup info for claude-code
    let setup: {
      hasBotAccount: boolean;
      botOnline: boolean;
      botUsername: string | null;
      botTokenPrefix: string | null;
      lastConnected: string | null;
      ownerId: string;
    } | null = null;

    if (params.pluginId === "claude-code") {
      const [botRow] = await db
        .select({
          tokenPrefix: bots.tokenPrefix,
          lastUsedAt: bots.lastUsedAt,
          username: user.username,
          status: user.status,
        })
        .from(bots)
        .innerJoin(user, eq(bots.userId, user.id))
        .where(eq(bots.ownerId, sessionUser.id))
        .orderBy(desc(bots.createdAt))
        .limit(1);

      setup = {
        hasBotAccount: !!botRow,
        botOnline: botRow?.status !== "offline" && !!botRow,
        botUsername: botRow?.username ?? null,
        botTokenPrefix: botRow?.tokenPrefix ?? null,
        lastConnected: botRow?.lastUsedAt?.toISOString() ?? null,
        ownerId: sessionUser.id,
      };
    }

    return { plugin, setup };
  })

  // ── POST /api/plugins/:pluginId/install — install for current user ────
  .post("/:pluginId/install", async ({ user: sessionUser, params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, "plugin-install"))) {
      throw new RateLimitError("Too many requests, try again later");
    }
    const catalog = findPlugin(params.pluginId);
    if (!catalog) throw new NotFoundError("Plugin");

    // Upsert — ignore if already installed
    await db
      .insert(pluginInstalls)
      .values({
        pluginId: params.pluginId,
        userId: sessionUser.id,
      })
      .onConflictDoNothing({ target: [pluginInstalls.pluginId, pluginInstalls.userId] });

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pluginInstalls)
      .where(eq(pluginInstalls.pluginId, params.pluginId));

    return { success: true, installCount: countRow?.count ?? 0 };
  })

  // ── DELETE /api/plugins/:pluginId/install — uninstall ─────────────────
  .delete("/:pluginId/install", async ({ user: sessionUser, params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, "plugin-install"))) {
      throw new RateLimitError("Too many requests, try again later");
    }
    const catalog = findPlugin(params.pluginId);
    if (!catalog) throw new NotFoundError("Plugin");

    await db
      .delete(pluginInstalls)
      .where(
        and(
          eq(pluginInstalls.pluginId, params.pluginId),
          eq(pluginInstalls.userId, sessionUser.id),
        ),
      );

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pluginInstalls)
      .where(eq(pluginInstalls.pluginId, params.pluginId));

    return { success: true, installCount: countRow?.count ?? 0 };
  });
