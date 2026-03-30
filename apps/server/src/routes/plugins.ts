import { Elysia } from "elysia";
import { eq, and, sql, desc } from "drizzle-orm";
import { NotFoundError, RateLimitError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { pluginRegistry, pluginInstalls, bots, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Public routes (no auth) ─────────────────────────────────────────────────

export const pluginPublicRoutes = new Elysia({ prefix: "/api/plugins" })

  // ── GET /api/plugins/:pluginId/manifest — public manifest endpoint ────
  .get("/:pluginId/manifest", async ({ params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 30, 60_000, RL.PLUGIN_MANIFEST))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    const [row] = await db
      .select({ manifest: pluginRegistry.manifest, published: pluginRegistry.published })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, params.pluginId))
      .limit(1);

    if (!row || !row.published) throw new NotFoundError("Plugin");

    return { manifest: row.manifest };
  });

// ── Authenticated routes ────────────────────────────────────────────────────

export const pluginRoutes = new Elysia({ prefix: "/api/plugins" })
  .resolve(authResolve())

  // ── GET /api/plugins — list published plugins with install counts + user status ──
  .get("/", async ({ user: sessionUser }) => {
    const rows = await db
      .select()
      .from(pluginRegistry)
      .where(eq(pluginRegistry.published, true))
      .orderBy(desc(pluginRegistry.featured), pluginRegistry.name);

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

    const plugins = rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      author: p.author,
      icon: p.iconUrl,
      category: p.category,
      scope: p.scope as "server" | "personal" | "both",
      tags: p.tags,
      version: p.version,
      verified: p.verified,
      featured: p.featured,
      downloads: p.downloads,
      repository: p.repository,
      screenshots: p.screenshots,
      installCount: countMap.get(p.id) ?? 0,
      installed: userInstallMap.has(p.id),
      installedAt: userInstallMap.get(p.id)?.toISOString() ?? null,
    }));

    return { plugins };
  })

  // ── GET /api/plugins/:pluginId — detail with setup status ─────────────
  .get("/:pluginId", async ({ user: sessionUser, params }) => {
    const [row] = await db
      .select()
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, params.pluginId))
      .limit(1);

    if (!row || !row.published) throw new NotFoundError("Plugin");

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
      id: row.id,
      name: row.name,
      description: row.description,
      author: row.author,
      icon: row.iconUrl,
      category: row.category,
      scope: row.scope as "server" | "personal" | "both",
      tags: row.tags,
      version: row.version,
      verified: row.verified,
      featured: row.featured,
      downloads: row.downloads,
      repository: row.repository,
      screenshots: row.screenshots,
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
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.PLUGIN_INSTALL))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    // Validate plugin exists in registry
    const [plugin] = await db
      .select({ id: pluginRegistry.id })
      .from(pluginRegistry)
      .where(and(eq(pluginRegistry.id, params.pluginId), eq(pluginRegistry.published, true)))
      .limit(1);
    if (!plugin) throw new NotFoundError("Plugin");

    // Upsert — ignore if already installed
    const [inserted] = await db
      .insert(pluginInstalls)
      .values({
        pluginId: params.pluginId,
        userId: sessionUser.id,
      })
      .onConflictDoNothing({ target: [pluginInstalls.pluginId, pluginInstalls.userId] })
      .returning({ id: pluginInstalls.id });

    // Only increment downloads when a new install row was created
    if (inserted) {
      await db
        .update(pluginRegistry)
        .set({ downloads: sql`${pluginRegistry.downloads} + 1` })
        .where(eq(pluginRegistry.id, params.pluginId));
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pluginInstalls)
      .where(eq(pluginInstalls.pluginId, params.pluginId));

    return { success: true, installCount: countRow?.count ?? 0 };
  })

  // ── DELETE /api/plugins/:pluginId/install — uninstall ─────────────────
  .delete("/:pluginId/install", async ({ user: sessionUser, params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.PLUGIN_INSTALL))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    // Validate plugin exists in registry and is published
    const [plugin] = await db
      .select({ id: pluginRegistry.id })
      .from(pluginRegistry)
      .where(and(eq(pluginRegistry.id, params.pluginId), eq(pluginRegistry.published, true)))
      .limit(1);
    if (!plugin) throw new NotFoundError("Plugin");

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
