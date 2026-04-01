import { Elysia } from "elysia";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { NotFoundError, RateLimitError } from "@uncorded/shared";
import { z } from "zod";
import { validateInput } from "../helpers/validation.js";
import { db } from "../db/index.js";
import { pluginRegistry, pluginInstalls, bots, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";
import { getClientIp } from "../helpers/request.js";
import { RL } from "../helpers/rate-limit-keys.js";

function compareSemver(a: string, b: string): number {
  // Strip build metadata first, then split core from prerelease at first hyphen
  const cleanA = a.split("+")[0] ?? a;
  const cleanB = b.split("+")[0] ?? b;
  const dashA = cleanA.indexOf("-");
  const dashB = cleanB.indexOf("-");
  const coreA = dashA === -1 ? cleanA : cleanA.slice(0, dashA);
  const preA = dashA === -1 ? undefined : cleanA.slice(dashA + 1);
  const coreB = dashB === -1 ? cleanB : cleanB.slice(0, dashB);
  const preB = dashB === -1 ? undefined : cleanB.slice(dashB + 1);
  const pa = coreA.split(".").map((s) => Number(s) || 0);
  const pb = coreB.split(".").map((s) => Number(s) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // A version without prerelease is greater than one with prerelease
  if (!preA && preB) return 1;
  if (preA && !preB) return -1;
  if (preA && preB) {
    const partsA = preA.split(".");
    const partsB = preB.split(".");
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const segA = partsA[i];
      const segB = partsB[i];
      if (segA === undefined) return -1;
      if (segB === undefined) return 1;
      const numA = Number(segA);
      const numB = Number(segB);
      const aIsNum = !Number.isNaN(numA);
      const bIsNum = !Number.isNaN(numB);
      if (aIsNum && bIsNum) {
        if (numA !== numB) return numA - numB;
      } else if (aIsNum) {
        return -1; // numeric < non-numeric
      } else if (bIsNum) {
        return 1;
      } else {
        const cmp = segA < segB ? -1 : segA > segB ? 1 : 0;
        if (cmp !== 0) return cmp;
      }
    }
  }
  return 0;
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
  })

  // ── POST /api/plugins/check-updates — batch version check ───────────
  .post("/check-updates", async ({ body, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.PLUGIN_CHECK_UPDATES))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    const checkUpdatesSchema = z.object({
      plugins: z.array(
        z.object({
          id: z.string().min(1),
          version: z.string().min(1),
        }),
      ).max(50),
    });

    const { plugins } = validateInput(checkUpdatesSchema, body);
    if (plugins.length === 0) return { updates: [] };

    const input = plugins;
    const ids = input.map((p) => p.id);

    const rows = await db
      .select({
        id: pluginRegistry.id,
        version: pluginRegistry.version,
        manifest: pluginRegistry.manifest,
      })
      .from(pluginRegistry)
      .where(and(eq(pluginRegistry.published, true), inArray(pluginRegistry.id, ids)));

    const inputMap = new Map(input.map((p) => [p.id, p.version]));

    const updates = rows
      .filter((row) => {
        const currentVersion = inputMap.get(row.id);
        if (!currentVersion || !row.version) return false;
        return compareSemver(row.version, currentVersion) > 0;
      })
      .map((row) => ({
        pluginId: row.id,
        currentVersion: inputMap.get(row.id)!,
        latestVersion: row.version,
        manifest: row.manifest,
      }));

    return { updates };
  });
