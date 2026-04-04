import { Elysia } from "elysia";
import { eq, like, or, and, desc, count, isNull, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  InternalError,
  DEV_STATE_PATH,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import {
  user,
  admins,
  servers,
  messages,
  reports,
  feedback,
  adminAuditLog,
  polls,
  pollEntries,
  pollVotes,
  giftedSubscriptions,
  bots,
  pluginRegistry,
  pluginInstalls,
  serverPlugins,
  pluginSubmissions,
} from "../db/schema.js";

import { readdir } from "node:fs/promises";
import { adminResolve } from "../middleware/admin.js";
import { validateInput } from "../helpers/validation.js";
import { findOrThrow } from "../helpers/query.js";
import { disconnectUser, sendToUser } from "../ws/connections.js";
import { Opcode } from "@uncorded/protocol";
import { computeEffectiveTier } from "../helpers/resolve-tier.js";
import { pageQuerySchema, flexPageQuerySchema } from "../helpers/pagination.js";

const adminPageQuery = pageQuerySchema(50);
const botsPageQuery = flexPageQuerySchema({ pageSize: 25, maxPageSize: 50 });

const devStateSchema = z.object({
  branch: z.string(),
  switchedAt: z.string().nullable(),
  switchedBy: z.string().nullable(),
  status: z.enum(["active", "pending"]),
});

type DevState = z.infer<typeof devStateSchema>;

const DEV_STATE_DEFAULT: DevState = {
  branch: "dev",
  switchedAt: null,
  switchedBy: null,
  status: "active",
};

async function loadDevState(): Promise<DevState> {
  const stateFile = Bun.file(DEV_STATE_PATH);
  if (!(await stateFile.exists())) return DEV_STATE_DEFAULT;
  let raw: unknown;
  try {
    raw = await stateFile.json();
  } catch (err) {
    console.error("Failed to read dev-state/branch.json:", err);
    throw new InternalError("Failed to read dev environment state");
  }
  const parsed = devStateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Corrupt dev-state/branch.json:", parsed.error.message);
    throw new InternalError("Dev environment state file is corrupt");
  }
  return parsed.data;
}

async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: string,
) {
  await db.insert(adminAuditLog).values({
    adminId,
    action,
    targetType,
    targetId,
    details: details ?? null,
  });
}

const ALLOWED_REGISTRIES = new Set(["registry-1.docker.io", "ghcr.io", "docker.io"]);

function isAllowedRegistryHost(hostname: string): boolean {
  return ALLOWED_REGISTRIES.has(hostname);
}

async function checkRegistryImage(imageRef: string): Promise<string | null> {
  const parts = imageRef.split(":");
  const imagePath = parts[0]!;
  const tag = parts[1] ?? "latest";
  const isHub = !imagePath.includes(".");
  const registryHost = isHub ? "registry-1.docker.io" : imagePath.split("/")[0]!;
  const repo = isHub
    ? imagePath.includes("/")
      ? imagePath
      : `library/${imagePath}`
    : imagePath.split("/").slice(1).join("/");

  if (!isAllowedRegistryHost(registryHost)) {
    return `Image "${imageRef}": registry "${registryHost}" is not in the allowlist`;
  }

  const manifestUrl = `https://${registryHost}/v2/${repo}/manifests/${tag}`;
  const accept =
    "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    let res = await fetch(manifestUrl, {
      method: "HEAD",
      headers: { Accept: accept },
      signal: controller.signal,
    });

    // OCI token handshake: 401 → fetch anonymous token → retry
    if (res.status === 401) {
      const wwwAuth = res.headers.get("www-authenticate") ?? "";
      const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1];
      const service = wwwAuth.match(/service="([^"]+)"/)?.[1];
      const scope = wwwAuth.match(/scope="([^"]+)"/)?.[1] ?? `repository:${repo}:pull`;
      if (!realm) return `Image "${imageRef}": registry requires auth but no realm provided`;

      const tokenUrl = new URL(realm);
      if (!isAllowedRegistryHost(tokenUrl.hostname)) {
        return `Image "${imageRef}": token service host "${tokenUrl.hostname}" is not allowed`;
      }
      if (service) tokenUrl.searchParams.set("service", service);
      tokenUrl.searchParams.set("scope", scope);
      const tokenRes = await fetch(tokenUrl.toString(), {
        signal: controller.signal,
      });
      if (!tokenRes.ok) return `Image "${imageRef}": token service returned ${tokenRes.status}`;
      const { token, access_token } = (await tokenRes.json()) as {
        token?: string;
        access_token?: string;
      };
      const authToken = token ?? access_token;
      if (!authToken) return `Image "${imageRef}": token service returned no token`;

      res = await fetch(manifestUrl, {
        method: "HEAD",
        headers: { Accept: accept, Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
    }

    if (res.status === 404) return `Image "${imageRef}" not found in registry`;
    if (!res.ok) return `Image "${imageRef}" returned ${res.status}`;
    return null;
  } catch {
    return `Image "${imageRef}": registry unreachable or timed out`;
  } finally {
    clearTimeout(timer);
  }
}

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .resolve(adminResolve())

  // ── Stats ─────────────────────────────────────────────────────────────────
  .get("/stats", async () => {
    const [[userCount], [serverCount], [messageCount], [unresolvedReports], [openFeedback]] =
      await Promise.all([
        db.select({ value: count() }).from(user),
        db.select({ value: count() }).from(servers),
        db.select({ value: count() }).from(messages),
        db.select({ value: count() }).from(reports).where(eq(reports.resolved, false)),
        db.select({ value: count() }).from(feedback).where(eq(feedback.status, "open")),
      ]);

    return {
      totalUsers: userCount?.value ?? 0,
      totalServers: serverCount?.value ?? 0,
      totalMessages: messageCount?.value ?? 0,
      unresolvedReports: unresolvedReports?.value ?? 0,
      openFeedback: openFeedback?.value ?? 0,
    };
  })

  // ── User Management ───────────────────────────────────────────────────────
  .get("/users", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);
    const search = typeof query.search === "string" ? query.search.trim() : "";

    const escaped = search.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const searchFilter = search
      ? or(like(user.username, `%${escaped}%`), like(user.email, `%${escaped}%`))
      : undefined;
    const conditions = and(eq(user.isBot, false), searchFilter);

    const now = new Date();
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          subscriptionTier: user.subscriptionTier,
          status: user.status,
          banned: user.banned,
          createdAt: user.createdAt,
          giftedTier: giftedSubscriptions.tier,
          giftExpiresAt: giftedSubscriptions.expiresAt,
          botCount: sql<number>`(select count(*)::int from bots where bots.owner_id = ${user.id})`,
        })
        .from(user)
        .leftJoin(
          giftedSubscriptions,
          and(
            eq(user.id, giftedSubscriptions.userId),
            sql`${giftedSubscriptions.expiresAt} > ${now}`,
          ),
        )
        .where(conditions)
        .orderBy(desc(user.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(user).where(conditions),
    ]);

    const users = rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      email: r.email,
      subscriptionTier: r.subscriptionTier,
      status: r.status,
      banned: r.banned,
      createdAt: r.createdAt,
      giftedTier: r.giftedTier ?? null,
      giftExpiresAt: r.giftExpiresAt?.toISOString() ?? null,
      botCount: r.botCount,
    }));

    return { users, total: total?.value ?? 0, page, pageSize };
  })

  .post("/users/:id/ban", async ({ params, user: sessionUser, adminLevel }) => {
    if (params.id === sessionUser.id) throw new ValidationError("Cannot ban yourself");

    await findOrThrow(
      db
        .select({ id: user.id, banned: user.banned })
        .from(user)
        .where(eq(user.id, params.id))
        .limit(1),
      "User",
    );

    // Prevent banning fellow admins/owners unless you're the owner
    const [targetAdmin] = await db
      .select({ level: admins.level })
      .from(admins)
      .where(eq(admins.userId, params.id))
      .limit(1);
    if (targetAdmin && adminLevel !== "owner") {
      throw new ForbiddenError("Cannot ban an admin — owner access required");
    }

    await db.update(user).set({ banned: true }).where(eq(user.id, params.id));
    await logAudit(sessionUser.id, "ban_user", "user", params.id);

    // Immediately disconnect banned user from WebSocket
    disconnectUser(params.id);

    return { success: true };
  })

  .post("/users/:id/unban", async ({ params, user: sessionUser, adminLevel }) => {
    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, params.id)).limit(1),
      "User",
    );

    // Same privilege check as ban — non-owners can't unban admins
    const [targetAdmin] = await db
      .select({ level: admins.level })
      .from(admins)
      .where(eq(admins.userId, params.id))
      .limit(1);
    if (targetAdmin && adminLevel !== "owner") {
      throw new ForbiddenError("Cannot unban an admin — owner access required");
    }

    await db.update(user).set({ banned: false }).where(eq(user.id, params.id));
    await logAudit(sessionUser.id, "unban_user", "user", params.id);

    return { success: true };
  })

  .post("/users/:id/gift-tier", async ({ params, body, user: sessionUser }) => {
    const giftTierSchema = z.object({
      tier: z.enum(["supporter", "server_owner"]),
      days: z.number().int().min(1).max(365),
      reason: z.string().max(500).optional(),
    });
    const { tier, days, reason } = validateInput(giftTierSchema, body);

    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, params.id)).limit(1),
      "User",
    );

    const expiresAt = new Date(Date.now() + days * 86400000);

    await db
      .insert(giftedSubscriptions)
      .values({
        userId: params.id,
        tier,
        giftedBy: sessionUser.id,
        reason: reason ?? null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: giftedSubscriptions.userId,
        set: {
          tier,
          giftedBy: sessionUser.id,
          reason: reason ?? null,
          expiresAt,
        },
      });

    // Recompute effective tier and update user record
    const effectiveTier = await computeEffectiveTier(params.id);
    await db.update(user).set({ subscriptionTier: effectiveTier }).where(eq(user.id, params.id));

    sendToUser(params.id, {
      op: Opcode.SUBSCRIPTION_GIFT,
      d: { tier, expiresAt: expiresAt.toISOString(), days },
    });

    await logAudit(
      sessionUser.id,
      "gift_tier",
      "user",
      params.id,
      JSON.stringify({ tier, days, reason }),
    );

    return { success: true };
  })

  .post("/users/:id/revoke-gift", async ({ params, user: sessionUser }) => {
    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, params.id)).limit(1),
      "User",
    );

    const result = await db
      .delete(giftedSubscriptions)
      .where(eq(giftedSubscriptions.userId, params.id))
      .returning({ id: giftedSubscriptions.id });
    if (result.length === 0) throw new NotFoundError("Gift");

    // Recompute effective tier and update user record
    const effectiveTier = await computeEffectiveTier(params.id);
    await db.update(user).set({ subscriptionTier: effectiveTier }).where(eq(user.id, params.id));

    await logAudit(sessionUser.id, "revoke_gift", "user", params.id);

    return { success: true };
  })

  .delete("/users/:id", async ({ params, user: sessionUser, adminLevel }) => {
    if (adminLevel !== "owner") throw new ForbiddenError("Owner access required");

    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, params.id)).limit(1),
      "User",
    );

    if (params.id === sessionUser.id) {
      throw new ValidationError("Cannot delete your own account via admin panel");
    }

    // Check server ownership — servers.ownerId has ON DELETE RESTRICT
    const [ownedServer] = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.ownerId, params.id))
      .limit(1);
    if (ownedServer) {
      throw new ValidationError(
        "Cannot delete user who owns servers. Transfer or delete servers first.",
      );
    }

    await db.delete(user).where(eq(user.id, params.id));
    await logAudit(sessionUser.id, "delete_user", "user", params.id);

    return { success: true };
  })

  // ── User Bots ────────────────────────────────────────────────────────────
  .get("/users/:id/bots", async ({ params, query }) => {
    const { page, pageSize, offset } = botsPageQuery.parse(query);

    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, params.id)).limit(1),
      "User",
    );

    const condition = eq(bots.ownerId, params.id);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: bots.id,
          name: bots.name,
          description: bots.description,
          username: user.username,
          tokenPrefix: bots.tokenPrefix,
          lastUsedAt: bots.lastUsedAt,
          createdAt: bots.createdAt,
        })
        .from(bots)
        .innerJoin(user, eq(bots.userId, user.id))
        .where(condition)
        .orderBy(desc(bots.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(bots).where(condition),
    ]);

    return {
      bots: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        username: r.username,
        tokenPrefix: r.tokenPrefix,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  })

  // ── Report Management ─────────────────────────────────────────────────────
  .get("/reports", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);
    const filter = query.filter as string | undefined;
    const typeFilter = query.type as string | undefined;

    const targetUser = alias(user, "target_user");
    const reportServer = alias(servers, "report_server");

    const resolvedCondition =
      filter === "resolved"
        ? eq(reports.resolved, true)
        : filter === "unresolved"
          ? eq(reports.resolved, false)
          : undefined;
    const allowedTypes = new Set(["message", "file", "player", "server"]);
    if (typeFilter && typeFilter !== "all" && !allowedTypes.has(typeFilter)) {
      throw new ValidationError("Invalid report type filter");
    }
    const typeCondition =
      typeFilter && typeFilter !== "all"
        ? eq(reports.type, typeFilter as "message" | "file" | "player" | "server")
        : undefined;
    const whereClause = and(resolvedCondition, typeCondition);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: reports.id,
          reporterId: reports.reporterId,
          type: reports.type,
          messageId: reports.messageId,
          fileReceiptId: reports.fileReceiptId,
          targetUserId: reports.targetUserId,
          serverId: reports.serverId,
          category: reports.category,
          details: reports.details,
          resolved: reports.resolved,
          createdAt: reports.createdAt,
          reporterUsername: user.username,
          targetUsername: targetUser.username,
          serverName: reportServer.name,
        })
        .from(reports)
        .leftJoin(user, eq(reports.reporterId, user.id))
        .leftJoin(targetUser, eq(reports.targetUserId, targetUser.id))
        .leftJoin(reportServer, eq(reports.serverId, reportServer.id))
        .where(whereClause)
        .orderBy(desc(reports.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(reports).where(whereClause),
    ]);

    return { reports: rows, total: total?.value ?? 0, page, pageSize };
  })

  .post("/reports/:id/resolve", async ({ params, user: sessionUser }) => {
    await findOrThrow(
      db.select({ id: reports.id }).from(reports).where(eq(reports.id, params.id)).limit(1),
      "Report",
    );

    await db.update(reports).set({ resolved: true }).where(eq(reports.id, params.id));
    await logAudit(sessionUser.id, "resolve_report", "report", params.id);

    return { success: true };
  })

  .delete("/reports/:id", async ({ params, user: sessionUser }) => {
    await findOrThrow(
      db.select({ id: reports.id }).from(reports).where(eq(reports.id, params.id)).limit(1),
      "Report",
    );

    await db.delete(reports).where(eq(reports.id, params.id));
    await logAudit(sessionUser.id, "delete_report", "report", params.id);

    return { success: true };
  })

  // ── Feedback Management ───────────────────────────────────────────────────
  .get("/feedback", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: feedback.id,
          authorId: feedback.authorId,
          type: feedback.type,
          title: feedback.title,
          description: feedback.description,
          status: feedback.status,
          voteCount: feedback.voteCount,
          adminNote: feedback.adminNote,
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
          authorUsername: user.username,
        })
        .from(feedback)
        .leftJoin(user, eq(feedback.authorId, user.id))
        .orderBy(desc(feedback.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(feedback),
    ]);

    return { feedback: rows, total: total?.value ?? 0, page, pageSize };
  })

  .patch("/feedback/:id", async ({ params, body, user: sessionUser }) => {
    const updateFeedbackSchema = z.object({
      status: z.enum(["open", "in_progress", "completed", "rejected"]).optional(),
      adminNote: z.string().max(1000).optional(),
    });
    const parsed = validateInput(updateFeedbackSchema, body);

    await findOrThrow(
      db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, params.id)).limit(1),
      "Feedback",
    );

    const updates: Record<string, unknown> = {};
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.adminNote !== undefined) updates.adminNote = parsed.adminNote;

    if (Object.keys(updates).length > 0) {
      await db.update(feedback).set(updates).where(eq(feedback.id, params.id));
    }

    await logAudit(
      sessionUser.id,
      "update_feedback",
      "feedback",
      params.id,
      JSON.stringify(parsed),
    );

    return { success: true };
  })

  .delete("/feedback/:id", async ({ params, user: sessionUser }) => {
    await findOrThrow(
      db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, params.id)).limit(1),
      "Feedback",
    );

    await db.delete(feedback).where(eq(feedback.id, params.id));
    await logAudit(sessionUser.id, "delete_feedback", "feedback", params.id);

    return { success: true };
  })

  // ── Admin Management (owner only) ─────────────────────────────────────────
  .get("/admins", async () => {
    const rows = await db
      .select({
        id: admins.id,
        userId: admins.userId,
        level: admins.level,
        addedAt: admins.addedAt,
        username: user.username,
        email: user.email,
      })
      .from(admins)
      .leftJoin(user, eq(admins.userId, user.id))
      .orderBy(admins.addedAt);

    return { admins: rows };
  })

  .post("/admins", async ({ body, user: sessionUser, adminLevel }) => {
    if (adminLevel !== "owner") throw new ForbiddenError("Owner access required");

    const parsed = z.object({ userId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw new ValidationError("userId is required");
    const { userId } = parsed.data;

    await findOrThrow(
      db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1),
      "User",
    );

    const [existing] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.userId, userId))
      .limit(1);
    if (existing) throw new ValidationError("User is already an admin");

    await db.insert(admins).values({
      userId,
      level: "admin",
      addedBy: sessionUser.id,
    });

    await logAudit(sessionUser.id, "add_admin", "admin", userId);

    return { success: true };
  })

  .delete("/admins/:id", async ({ params, user: sessionUser, adminLevel }) => {
    if (adminLevel !== "owner") throw new ForbiddenError("Owner access required");

    const adminRecord = await findOrThrow(
      db
        .select({ id: admins.id, userId: admins.userId, level: admins.level })
        .from(admins)
        .where(eq(admins.id, params.id))
        .limit(1),
      "Admin",
    );

    if (adminRecord.userId === sessionUser.id) {
      throw new ValidationError("Cannot remove yourself as admin");
    }
    if (adminRecord.level === "owner") {
      throw new ValidationError("Cannot remove owner");
    }

    await db.delete(admins).where(eq(admins.id, params.id));
    await logAudit(sessionUser.id, "remove_admin", "admin", adminRecord.userId);

    return { success: true };
  })

  // ── Poll Management ──────────────────────────────────────────────────────
  .get("/polls", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: polls.id,
          createdAt: polls.createdAt,
          closedAt: polls.closedAt,
          winnerId: polls.winnerId,
        })
        .from(polls)
        .orderBy(desc(polls.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(polls),
    ]);

    // Bulk-fetch entries and votes for all polls to avoid N+1
    const pollIds = rows.map((r) => r.id);

    const [allEntries, allVoteCounts] =
      pollIds.length > 0
        ? await Promise.all([
            db
              .select({
                pollId: pollEntries.pollId,
                feedbackId: pollEntries.feedbackId,
                title: feedback.title,
                description: feedback.description,
              })
              .from(pollEntries)
              .innerJoin(feedback, eq(pollEntries.feedbackId, feedback.id))
              .where(inArray(pollEntries.pollId, pollIds)),
            db
              .select({
                pollId: pollVotes.pollId,
                feedbackId: pollVotes.feedbackId,
                count: sql<number>`count(*)::int`,
              })
              .from(pollVotes)
              .where(inArray(pollVotes.pollId, pollIds))
              .groupBy(pollVotes.pollId, pollVotes.feedbackId),
          ])
        : [[], []];

    // Build lookup maps
    const entriesByPoll = new Map<string, typeof allEntries>();
    for (const e of allEntries) {
      const list = entriesByPoll.get(e.pollId) ?? [];
      list.push(e);
      entriesByPoll.set(e.pollId, list);
    }
    const votesByPoll = new Map<string, Map<string, number>>();
    for (const v of allVoteCounts) {
      const map = votesByPoll.get(v.pollId) ?? new Map();
      map.set(v.feedbackId, v.count);
      votesByPoll.set(v.pollId, map);
    }

    const pollsWithEntries = rows.map((poll) => {
      const entries = entriesByPoll.get(poll.id) ?? [];
      const voteMap = votesByPoll.get(poll.id) ?? new Map();
      const totalVotes = [...voteMap.values()].reduce((sum, c) => sum + c, 0);
      return {
        id: poll.id,
        createdAt: poll.createdAt.toISOString(),
        closedAt: poll.closedAt?.toISOString() ?? null,
        winnerId: poll.winnerId,
        entries: entries.map((e) => ({
          feedbackId: e.feedbackId,
          title: e.title,
          description: e.description,
          pollVotes: voteMap.get(e.feedbackId) ?? 0,
        })),
        totalVotes,
      };
    });

    return { polls: pollsWithEntries, total: total?.value ?? 0, page, pageSize };
  })

  .post("/polls", async ({ user: sessionUser }) => {
    // Get top 5 open features by vote count
    const topFeatures = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(and(eq(feedback.type, "feature"), eq(feedback.status, "open")))
      .orderBy(desc(feedback.voteCount))
      .limit(5);

    if (topFeatures.length < 5) {
      throw new ValidationError("Need at least 5 open feature requests to create a poll");
    }

    // Create poll + entries in transaction (active-poll check inside tx to prevent race)
    let pollId: string;
    try {
      pollId = await db.transaction(async (tx) => {
        const [activePoll] = await tx
          .select({ id: polls.id })
          .from(polls)
          .where(isNull(polls.closedAt))
          .limit(1);
        if (activePoll) throw new ValidationError("An active poll already exists");

        const [newPoll] = await tx.insert(polls).values({}).returning({ id: polls.id });
        if (!newPoll) throw new InternalError("Failed to create poll");
        const newPollId = newPoll.id;

        await tx.insert(pollEntries).values(
          topFeatures.map((f) => ({
            pollId: newPollId,
            feedbackId: f.id,
          })),
        );

        return newPollId;
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) throw err;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        throw new ValidationError("An active poll already exists");
      }
      throw err;
    }

    await logAudit(sessionUser.id, "create_poll", "poll", pollId);

    return { success: true, pollId };
  })

  .post("/polls/:id/close", async ({ params, user: sessionUser }) => {
    await db.transaction(async (tx) => {
      // Re-read inside transaction to ensure poll is still open
      const poll = await findOrThrow(
        tx
          .select({ id: polls.id, closedAt: polls.closedAt })
          .from(polls)
          .where(eq(polls.id, params.id))
          .limit(1),
        "Poll",
      );
      if (poll.closedAt) throw new ValidationError("Poll is already closed");

      // Count votes per entry + fetch feedback.voteCount in a single join query
      const entriesWithVotes = await tx
        .select({
          feedbackId: pollVotes.feedbackId,
          pollVoteCount: sql<number>`count(*)::int`,
          feedbackVoteCount: feedback.voteCount,
        })
        .from(pollVotes)
        .innerJoin(feedback, eq(pollVotes.feedbackId, feedback.id))
        .where(eq(pollVotes.pollId, params.id))
        .groupBy(pollVotes.feedbackId, feedback.voteCount);

      const totalVotes = entriesWithVotes.reduce((sum, v) => sum + v.pollVoteCount, 0);

      if (totalVotes === 0) {
        await tx
          .update(polls)
          .set({ closedAt: new Date(), winnerId: null })
          .where(eq(polls.id, params.id));
      } else {
        entriesWithVotes.sort((a, b) => {
          if (b.pollVoteCount !== a.pollVoteCount) return b.pollVoteCount - a.pollVoteCount;
          if ((b.feedbackVoteCount ?? 0) !== (a.feedbackVoteCount ?? 0))
            return (b.feedbackVoteCount ?? 0) - (a.feedbackVoteCount ?? 0);
          return a.feedbackId.localeCompare(b.feedbackId);
        });

        const winnerId = entriesWithVotes[0]!.feedbackId;

        await tx
          .update(polls)
          .set({ closedAt: new Date(), winnerId })
          .where(eq(polls.id, params.id));
        await tx.update(feedback).set({ status: "won_poll" }).where(eq(feedback.id, winnerId));
      }
    });

    await logAudit(sessionUser.id, "close_poll", "poll", params.id);

    return { success: true };
  })

  // ── Dev Environment (Branch Switcher) ────────────────────────────────────
  .get("/branches", async () => {
    try {
      const entries = await readdir("/app/worktrees", { withFileTypes: true });
      const branches = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .toSorted();
      return { branches };
    } catch (err) {
      console.error("Failed to read worktrees directory:", err);
      throw new InternalError("Failed to list branches");
    }
  })

  .get("/dev-status", async () => loadDevState())

  .post("/switch-dev", async ({ body, user: sessionUser }) => {
    const switchSchema = z.object({ branch: z.string().min(1) });
    const { branch } = validateInput(switchSchema, body);

    // Reject switching to the already-active branch
    const currentState = await loadDevState();
    if (currentState.branch === branch) {
      throw new ValidationError(`Dev environment is already set to "${branch}"`);
    }

    // Reject path traversal characters before touching the filesystem
    if (/[/\\]/.test(branch) || branch === ".." || branch === ".") {
      throw new ValidationError("Invalid branch name");
    }

    // Validate the branch exists as a worktree directory
    try {
      const entries = await readdir("/app/worktrees", { withFileTypes: true });
      const exists = entries.some((e) => e.isDirectory() && e.name === branch);
      if (!exists) throw new NotFoundError("Branch");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new InternalError("Failed to read worktrees directory");
    }

    const state = {
      branch,
      switchedAt: new Date().toISOString(),
      switchedBy: sessionUser.email ?? sessionUser.id,
      status: "pending" as const,
    };

    await Bun.write(DEV_STATE_PATH, JSON.stringify(state, null, 2));
    logAudit(sessionUser.id, "switch_dev", "dev_environment", branch).catch((err) =>
      console.error("audit log failed for switch_dev:", err),
    );

    return {
      success: true,
      branch,
      message: "Branch marked for switch. Tell Git Manager to run the rebuild.",
    };
  })

  // ── Audit Log ─────────────────────────────────────────────────────────────
  .get("/audit-log", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: adminAuditLog.id,
          adminId: adminAuditLog.adminId,
          action: adminAuditLog.action,
          targetType: adminAuditLog.targetType,
          targetId: adminAuditLog.targetId,
          details: adminAuditLog.details,
          createdAt: adminAuditLog.createdAt,
          adminUsername: user.username,
        })
        .from(adminAuditLog)
        .leftJoin(user, eq(adminAuditLog.adminId, user.id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(adminAuditLog),
    ]);

    return { entries: rows, total: total?.value ?? 0, page, pageSize };
  })

  // ── Plugin Management ────────────────────────────────────────────────────
  .get("/plugins", async ({ query }) => {
    const { page, pageSize, offset } = adminPageQuery.parse(query);
    const search = typeof query.search === "string" ? query.search.trim() : "";

    const escaped = search.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const searchFilter = search
      ? or(
          like(pluginRegistry.name, `%${escaped}%`),
          like(pluginRegistry.author, `%${escaped}%`),
          like(pluginRegistry.id, `%${escaped}%`),
        )
      : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(pluginRegistry)
        .where(searchFilter)
        .orderBy(desc(pluginRegistry.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(pluginRegistry).where(searchFilter),
    ]);

    const plugins = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      author: r.author,
      iconUrl: r.iconUrl,
      category: r.category,
      scope: r.scope,
      tags: r.tags ?? [],
      image: r.image,
      version: r.version,
      repository: r.repository,
      verified: r.verified ?? false,
      featured: r.featured ?? false,
      downloads: r.downloads ?? 0,
      published: r.published ?? true,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { plugins, total: total?.value ?? 0, page, pageSize };
  })

  .post("/plugins", async ({ body, user: sessionUser }) => {
    const pluginSchema = z.object({
      id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
      name: z.string().min(1).max(100),
      description: z.string().min(1).max(2000),
      author: z.string().min(1).max(100),
      iconUrl: z.string().max(500).nullable().optional(),
      category: z.string().min(1).max(50),
      scope: z.enum(["server", "personal", "both"]),
      tags: z.array(z.string().max(50)).max(20).optional(),
      image: z.string().min(1).max(500),
      version: z.string().min(1).max(20).optional(),
      manifest: z
        .object({
          runtime: z.object({
            image: z.string().min(1),
            port: z.number().int().min(1).max(65535),
            healthCheck: z.string().min(1),
          }),
          permissions: z.array(z.string()).min(1),
        })
        .passthrough(),
      repository: z.string().max(500).nullable().optional(),
      screenshots: z.array(z.string().max(500)).max(10).optional(),
    });

    const data = validateInput(pluginSchema, body);

    // Atomic insert with conflict check
    const [inserted] = await db
      .insert(pluginRegistry)
      .values({
        id: data.id,
        name: data.name,
        description: data.description,
        author: data.author,
        iconUrl: data.iconUrl ?? null,
        category: data.category,
        scope: data.scope,
        tags: data.tags ?? [],
        image: data.image,
        version: data.version ?? "1.0.0",
        manifest: data.manifest,
        repository: data.repository ?? null,
        screenshots: data.screenshots ?? [],
      })
      .onConflictDoNothing()
      .returning({ id: pluginRegistry.id });

    if (!inserted) throw new ValidationError("Plugin with this ID already exists");

    await logAudit(sessionUser.id, "create_plugin", "plugin", data.id);

    return { success: true };
  })

  .put("/plugins/:pluginId", async ({ params, body, user: sessionUser }) => {
    const pluginUpdateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(2000).optional(),
      author: z.string().min(1).max(100).optional(),
      iconUrl: z.string().max(500).nullable().optional(),
      category: z.string().min(1).max(50).optional(),
      scope: z.enum(["server", "personal", "both"]).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
      image: z.string().min(1).max(500).optional(),
      version: z.string().min(1).max(20).optional(),
      manifest: z
        .object({
          runtime: z.object({
            image: z.string().min(1),
            port: z.number().int().min(1).max(65535),
            healthCheck: z.string().min(1),
          }),
          permissions: z.array(z.string()).min(1),
        })
        .passthrough()
        .optional(),
      repository: z.string().max(500).nullable().optional(),
      screenshots: z.array(z.string().max(500)).max(10).optional(),
    });

    const data = validateInput(pluginUpdateSchema, body);

    await findOrThrow(
      db
        .select({ id: pluginRegistry.id })
        .from(pluginRegistry)
        .where(eq(pluginRegistry.id, params.pluginId))
        .limit(1),
      "Plugin",
    );

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.author !== undefined) updates.author = data.author;
    if (data.iconUrl !== undefined) updates.iconUrl = data.iconUrl;
    if (data.category !== undefined) updates.category = data.category;
    if (data.scope !== undefined) updates.scope = data.scope;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.image !== undefined) updates.image = data.image;
    if (data.version !== undefined) updates.version = data.version;
    if (data.manifest !== undefined) updates.manifest = data.manifest;
    if (data.repository !== undefined) updates.repository = data.repository;
    if (data.screenshots !== undefined) updates.screenshots = data.screenshots;

    if (Object.keys(updates).length > 0) {
      await db.update(pluginRegistry).set(updates).where(eq(pluginRegistry.id, params.pluginId));
    }

    await logAudit(
      sessionUser.id,
      "update_plugin",
      "plugin",
      params.pluginId,
      JSON.stringify(data),
    );

    return { success: true };
  })

  .delete("/plugins/:pluginId", async ({ params, user: sessionUser, adminLevel }) => {
    if (adminLevel !== "owner") throw new ForbiddenError("Owner access required");

    await db.transaction(async (tx) => {
      await findOrThrow(
        tx
          .select({ id: pluginRegistry.id })
          .from(pluginRegistry)
          .where(eq(pluginRegistry.id, params.pluginId))
          .limit(1),
        "Plugin",
      );

      // Cascade: remove from server_plugins and plugin_installs first
      await tx.delete(serverPlugins).where(eq(serverPlugins.pluginId, params.pluginId));
      await tx.delete(pluginInstalls).where(eq(pluginInstalls.pluginId, params.pluginId));
      await tx.delete(pluginRegistry).where(eq(pluginRegistry.id, params.pluginId));

      await logAudit(sessionUser.id, "delete_plugin", "plugin", params.pluginId);
    });

    return { success: true };
  })

  .patch("/plugins/:pluginId/publish", async ({ params, user: sessionUser }) => {
    const plugin = await findOrThrow(
      db
        .select({ id: pluginRegistry.id, published: pluginRegistry.published })
        .from(pluginRegistry)
        .where(eq(pluginRegistry.id, params.pluginId))
        .limit(1),
      "Plugin",
    );

    const newValue = !plugin.published;
    await db
      .update(pluginRegistry)
      .set({ published: newValue })
      .where(eq(pluginRegistry.id, params.pluginId));

    await logAudit(
      sessionUser.id,
      newValue ? "publish_plugin" : "unpublish_plugin",
      "plugin",
      params.pluginId,
    );

    return { success: true, published: newValue };
  })

  .patch("/plugins/:pluginId/verify", async ({ params, user: sessionUser }) => {
    const plugin = await findOrThrow(
      db
        .select({ id: pluginRegistry.id, verified: pluginRegistry.verified })
        .from(pluginRegistry)
        .where(eq(pluginRegistry.id, params.pluginId))
        .limit(1),
      "Plugin",
    );

    const newValue = !plugin.verified;
    await db
      .update(pluginRegistry)
      .set({ verified: newValue })
      .where(eq(pluginRegistry.id, params.pluginId));

    await logAudit(
      sessionUser.id,
      newValue ? "verify_plugin" : "unverify_plugin",
      "plugin",
      params.pluginId,
    );

    return { success: true, verified: newValue };
  })

  .patch("/plugins/:pluginId/feature", async ({ params, user: sessionUser }) => {
    const plugin = await findOrThrow(
      db
        .select({ id: pluginRegistry.id, featured: pluginRegistry.featured })
        .from(pluginRegistry)
        .where(eq(pluginRegistry.id, params.pluginId))
        .limit(1),
      "Plugin",
    );

    const newValue = !plugin.featured;
    await db
      .update(pluginRegistry)
      .set({ featured: newValue })
      .where(eq(pluginRegistry.id, params.pluginId));

    await logAudit(
      sessionUser.id,
      newValue ? "feature_plugin" : "unfeature_plugin",
      "plugin",
      params.pluginId,
    );

    return { success: true, featured: newValue };
  })

  // ── Plugin Submission Review ─────────────────────────────────────────────

  .get("/plugins/submissions", async ({ query }) => {
    const { page, pageSize, offset } = flexPageQuerySchema({ pageSize: 20, maxPageSize: 50 }).parse(
      query,
    );

    const author = alias(user, "author");

    const rows = await db
      .select({
        id: pluginSubmissions.id,
        pluginId: pluginSubmissions.pluginId,
        status: pluginSubmissions.status,
        submittedAt: pluginSubmissions.submittedAt,
        rejectionReason: pluginSubmissions.rejectionReason,
        reviewedAt: pluginSubmissions.reviewedAt,
        pluginName: pluginRegistry.name,
        pluginDescription: pluginRegistry.description,
        pluginVersion: pluginRegistry.version,
        pluginImage: pluginRegistry.image,
        authorId: author.id,
        authorUsername: author.username,
        authorDisplayName: author.displayName,
      })
      .from(pluginSubmissions)
      .innerJoin(pluginRegistry, eq(pluginSubmissions.pluginId, pluginRegistry.id))
      .innerJoin(author, eq(pluginSubmissions.authorUserId, author.id))
      .where(eq(pluginSubmissions.status, "pending"))
      .orderBy(pluginSubmissions.submittedAt)
      .limit(pageSize)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(pluginSubmissions)
      .where(eq(pluginSubmissions.status, "pending"));

    const submissions = rows.map((r) => ({
      id: r.id,
      pluginId: r.pluginId,
      status: r.status,
      submittedAt: r.submittedAt.toISOString(),
      rejectionReason: r.rejectionReason,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      plugin: {
        name: r.pluginName,
        description: r.pluginDescription,
        version: r.pluginVersion,
        image: r.pluginImage,
      },
      author: {
        id: r.authorId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
      },
    }));

    return { submissions, total: totalRow?.value ?? 0, page, pageSize };
  })

  .patch("/plugins/submissions/:id/approve", async ({ params, user: sessionUser }) => {
    const [submission] = await db
      .select({
        id: pluginSubmissions.id,
        status: pluginSubmissions.status,
        pluginId: pluginSubmissions.pluginId,
      })
      .from(pluginSubmissions)
      .where(eq(pluginSubmissions.id, params.id))
      .limit(1);

    if (!submission) throw new NotFoundError("Submission");
    if (submission.status !== "pending") throw new ValidationError("Submission is not pending");

    await db.transaction(async (tx) => {
      await tx
        .update(pluginSubmissions)
        .set({
          status: "approved",
          reviewedBy: sessionUser.id,
          reviewedAt: new Date(),
        })
        .where(eq(pluginSubmissions.id, params.id));

      await tx
        .update(pluginRegistry)
        .set({ published: true })
        .where(eq(pluginRegistry.id, submission.pluginId));

      await tx.insert(adminAuditLog).values({
        adminId: sessionUser.id,
        action: "approve_plugin_submission",
        targetType: "plugin_submission",
        targetId: params.id,
        details: null,
      });
    });

    // Best-effort Docker image validation (non-blocking)
    let imageWarning: string | null = null;
    try {
      const [reg] = await db
        .select({ image: pluginRegistry.image })
        .from(pluginRegistry)
        .where(eq(pluginRegistry.id, submission.pluginId))
        .limit(1);
      if (reg?.image) imageWarning = await checkRegistryImage(reg.image);
    } catch {
      imageWarning = "Image validation skipped due to error";
    }

    return { success: true, ...(imageWarning ? { warning: imageWarning } : {}) };
  })

  .patch("/plugins/submissions/:id/reject", async ({ params, body, user: sessionUser }) => {
    const rejectSchema = z.object({
      reason: z.string().min(1).max(500),
    });
    const data = validateInput(rejectSchema, body);

    const [submission] = await db
      .select({ id: pluginSubmissions.id, status: pluginSubmissions.status })
      .from(pluginSubmissions)
      .where(eq(pluginSubmissions.id, params.id))
      .limit(1);

    if (!submission) throw new NotFoundError("Submission");
    if (submission.status !== "pending") throw new ValidationError("Submission is not pending");

    await db
      .update(pluginSubmissions)
      .set({
        status: "rejected",
        rejectionReason: data.reason,
        reviewedBy: sessionUser.id,
        reviewedAt: new Date(),
      })
      .where(eq(pluginSubmissions.id, params.id));

    await logAudit(sessionUser.id, "reject_plugin_submission", "plugin_submission", params.id);

    return { success: true };
  });
