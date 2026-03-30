import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import {
  createReportSchema,
  RATE_LIMIT_REPORT_CREATE,
  ValidationError,
  NotFoundError,
  InternalError,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import { reports, messages, fileReceipts, user, servers, members } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { resolveChannelMembership } from "../helpers/resolve-channel.js";
import { validateInput } from "../helpers/validation.js";

export const reportRoutes = new Elysia({ prefix: "/api/reports" })
  .resolve(authResolve())
  .post("/", async ({ user: sessionUser, body, set }) => {
    const data = validateInput(createReportSchema, body);

    await checkUserRateLimit(
      sessionUser.id,
      RL.REPORT_CREATE,
      RATE_LIMIT_REPORT_CREATE.limit,
      RATE_LIMIT_REPORT_CREATE.windowMs,
    );

    // Per-type validation
    if (data.type === "message") {
      const [msg] = await db
        .select({ id: messages.id, channelId: messages.channelId })
        .from(messages)
        .where(eq(messages.id, data.messageId))
        .limit(1);
      if (!msg) throw new NotFoundError("Message");
      const resolution = await resolveChannelMembership(sessionUser.id, msg.channelId);
      if (!resolution) throw new NotFoundError("Message");
    } else if (data.type === "file") {
      const [fr] = await db
        .select({ id: fileReceipts.id, channelId: fileReceipts.channelId, senderId: fileReceipts.senderId, receiverId: fileReceipts.receiverId })
        .from(fileReceipts)
        .where(eq(fileReceipts.id, data.fileReceiptId))
        .limit(1);
      if (!fr) throw new NotFoundError("File receipt");
      if (fr.channelId) {
        const resolution = await resolveChannelMembership(sessionUser.id, fr.channelId);
        if (!resolution) throw new NotFoundError("File receipt");
      } else {
        // DM P2P receipt — verify user is sender or receiver
        if (fr.senderId !== sessionUser.id && fr.receiverId !== sessionUser.id) {
          throw new NotFoundError("File receipt");
        }
      }
    } else if (data.type === "player") {
      if (data.targetUserId === sessionUser.id) {
        throw new ValidationError("You cannot report yourself");
      }
      const [target] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, data.targetUserId))
        .limit(1);
      if (!target) throw new NotFoundError("User");
    } else if (data.type === "server") {
      const [srv] = await db
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.id, data.serverId))
        .limit(1);
      if (!srv) throw new NotFoundError("Server");
      const [membership] = await db
        .select({ userId: members.userId })
        .from(members)
        .where(and(eq(members.userId, sessionUser.id), eq(members.serverId, data.serverId)))
        .limit(1);
      if (!membership) throw new NotFoundError("Server");
    } else {
      // Exhaustive check: if a new type is added to the union, TypeScript will
      // error here because the narrowed type won't be `never`.
      const _exhaustive: never = data;
      throw new ValidationError(`Unknown report type: ${(_exhaustive as { type: string }).type}`);
    }

    const [report] = await db
      .insert(reports)
      .values({
        reporterId: sessionUser.id,
        type: data.type,
        messageId: data.type === "message" ? data.messageId : null,
        fileReceiptId: data.type === "file" ? data.fileReceiptId : null,
        targetUserId: data.type === "player" ? data.targetUserId : null,
        serverId: data.type === "server" ? data.serverId : null,
        category: data.category,
        details: data.details || null,
      })
      .returning({ id: reports.id });

    if (!report) throw new InternalError("Failed to create report");

    set.status = 201;
    return { id: report.id };
  });
