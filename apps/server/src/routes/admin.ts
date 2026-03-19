import { Elysia } from "elysia";
import { eq, like, or, desc, count } from "drizzle-orm";
import { z } from "zod";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
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
} from "../db/schema.js";
import { adminResolve } from "../middleware/admin.js";
import { disconnectUser } from "../ws/connections.js";

const PAGE_SIZE = 50;

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

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .resolve(adminResolve())

  // ── Stats ─────────────────────────────────────────────────────────────────
  .get("/stats", async () => {
    const [[userCount], [serverCount], [messageCount], [unresolvedReports], [openFeedback]] =
      await Promise.all([
        db.select({ value: count() }).from(user),
        db.select({ value: count() }).from(servers),
        db.select({ value: count() }).from(messages),
        db
          .select({ value: count() })
          .from(reports)
          .where(eq(reports.resolved, false)),
        db
          .select({ value: count() })
          .from(feedback)
          .where(eq(feedback.status, "open")),
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
    const page = Math.max(1, Number(query.page) || 1);
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const offset = (page - 1) * PAGE_SIZE;

    const escaped = search.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const conditions = search
      ? or(
          like(user.username, `%${escaped}%`),
          like(user.email, `%${escaped}%`),
        )
      : undefined;

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
        })
        .from(user)
        .where(conditions)
        .orderBy(desc(user.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ value: count() }).from(user).where(conditions),
    ]);

    return { users: rows, total: total?.value ?? 0, page, pageSize: PAGE_SIZE };
  })

  .post("/users/:id/ban", async ({ params, user: sessionUser, adminLevel }) => {
    if (params.id === sessionUser.id) throw new ValidationError("Cannot ban yourself");

    const [target] = await db
      .select({ id: user.id, banned: user.banned })
      .from(user)
      .where(eq(user.id, params.id))
      .limit(1);
    if (!target) throw new NotFoundError("User");

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
    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, params.id))
      .limit(1);
    if (!target) throw new NotFoundError("User");

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

  // Gift-tier and revoke-gift endpoints are added in feat/gifted-subscriptions PR

  .delete("/users/:id", async ({ params, user: sessionUser, adminLevel }) => {
    if (adminLevel !== "owner") throw new ForbiddenError("Owner access required");

    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, params.id))
      .limit(1);
    if (!target) throw new NotFoundError("User");

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
      throw new ValidationError("Cannot delete user who owns servers. Transfer or delete servers first.");
    }

    await db.delete(user).where(eq(user.id, params.id));
    await logAudit(sessionUser.id, "delete_user", "user", params.id);

    return { success: true };
  })

  // ── Report Management ─────────────────────────────────────────────────────
  .get("/reports", async ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const filter = query.filter as string | undefined;
    const offset = (page - 1) * PAGE_SIZE;

    const conditions =
      filter === "resolved"
        ? eq(reports.resolved, true)
        : filter === "unresolved"
          ? eq(reports.resolved, false)
          : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: reports.id,
          reporterId: reports.reporterId,
          messageId: reports.messageId,
          fileReceiptId: reports.fileReceiptId,
          category: reports.category,
          details: reports.details,
          resolved: reports.resolved,
          createdAt: reports.createdAt,
          reporterUsername: user.username,
        })
        .from(reports)
        .leftJoin(user, eq(reports.reporterId, user.id))
        .where(conditions)
        .orderBy(desc(reports.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ value: count() }).from(reports).where(conditions),
    ]);

    return { reports: rows, total: total?.value ?? 0, page, pageSize: PAGE_SIZE };
  })

  .post("/reports/:id/resolve", async ({ params, user: sessionUser }) => {
    const [report] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, params.id))
      .limit(1);
    if (!report) throw new NotFoundError("Report");

    await db.update(reports).set({ resolved: true }).where(eq(reports.id, params.id));
    await logAudit(sessionUser.id, "resolve_report", "report", params.id);

    return { success: true };
  })

  .delete("/reports/:id", async ({ params, user: sessionUser }) => {
    const [report] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, params.id))
      .limit(1);
    if (!report) throw new NotFoundError("Report");

    await db.delete(reports).where(eq(reports.id, params.id));
    await logAudit(sessionUser.id, "delete_report", "report", params.id);

    return { success: true };
  })

  // ── Feedback Management ───────────────────────────────────────────────────
  .get("/feedback", async ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

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
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ value: count() }).from(feedback),
    ]);

    return { feedback: rows, total: total?.value ?? 0, page, pageSize: PAGE_SIZE };
  })

  .patch("/feedback/:id", async ({ params, body, user: sessionUser }) => {
    const updateFeedbackSchema = z.object({
      status: z.enum(["open", "in_progress", "completed", "rejected"]).optional(),
      adminNote: z.string().max(1000).optional(),
    });
    const parsed = updateFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const [item] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, params.id))
      .limit(1);
    if (!item) throw new NotFoundError("Feedback");

    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.adminNote !== undefined) updates.adminNote = parsed.data.adminNote;

    if (Object.keys(updates).length > 0) {
      await db.update(feedback).set(updates).where(eq(feedback.id, params.id));
    }

    await logAudit(
      sessionUser.id,
      "update_feedback",
      "feedback",
      params.id,
      JSON.stringify(parsed.data),
    );

    return { success: true };
  })

  .delete("/feedback/:id", async ({ params, user: sessionUser }) => {
    const [item] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, params.id))
      .limit(1);
    if (!item) throw new NotFoundError("Feedback");

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

    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!target) throw new NotFoundError("User");

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

    const [adminRecord] = await db
      .select({ id: admins.id, userId: admins.userId, level: admins.level })
      .from(admins)
      .where(eq(admins.id, params.id))
      .limit(1);
    if (!adminRecord) throw new NotFoundError("Admin");

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

  // ── Audit Log ─────────────────────────────────────────────────────────────
  .get("/audit-log", async ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

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
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ value: count() }).from(adminAuditLog),
    ]);

    return { entries: rows, total: total?.value ?? 0, page, pageSize: PAGE_SIZE };
  });
