import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import {
  createReportSchema,
  RATE_LIMIT_REPORT_CREATE,
  ValidationError,
  NotFoundError,
  InternalError,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import { reports, messages, fileReceipts } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { resolveChannelMembership } from "../helpers/resolve-channel.js";

export const reportRoutes = new Elysia({ prefix: "/api/reports" })
  .resolve(authResolve())
  .post("/", async ({ user: sessionUser, body, set }) => {
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await checkUserRateLimit(
      sessionUser.id,
      "report:create",
      RATE_LIMIT_REPORT_CREATE.limit,
      RATE_LIMIT_REPORT_CREATE.windowMs,
    );

    if (parsed.data.messageId) {
      const [msg] = await db
        .select({ id: messages.id, channelId: messages.channelId })
        .from(messages)
        .where(eq(messages.id, parsed.data.messageId))
        .limit(1);
      if (!msg) throw new NotFoundError("Message");
      const resolution = await resolveChannelMembership(sessionUser.id, msg.channelId);
      if (!resolution) throw new NotFoundError("Message");
    }

    if (parsed.data.fileReceiptId) {
      const [fr] = await db
        .select({ id: fileReceipts.id, channelId: fileReceipts.channelId })
        .from(fileReceipts)
        .where(eq(fileReceipts.id, parsed.data.fileReceiptId))
        .limit(1);
      if (!fr) throw new NotFoundError("File receipt");
      const resolution = await resolveChannelMembership(sessionUser.id, fr.channelId);
      if (!resolution) throw new NotFoundError("File receipt");
    }

    const [report] = await db
      .insert(reports)
      .values({
        reporterId: sessionUser.id,
        messageId: parsed.data.messageId ?? null,
        fileReceiptId: parsed.data.fileReceiptId ?? null,
        category: parsed.data.category,
        details: parsed.data.details ?? null,
      })
      .returning({ id: reports.id });

    if (!report) throw new InternalError("Failed to create report");

    set.status = 201;
    return { id: report.id };
  });
