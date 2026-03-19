import { Elysia } from "elysia";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  createFeedbackSchema,
  ValidationError,
  NotFoundError,
  RATE_LIMIT_FEEDBACK_CREATE,
  RATE_LIMIT_FEEDBACK_VOTE,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import { feedback, feedbackVotes, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";

const PAGE_SIZE = 20;

export const feedbackRoutes = new Elysia({ prefix: "/api/feedback" })
  .resolve(authResolve())

  // ── List feedback (public) ────────────────────────────────────────────────
  .get("/", async ({ query, user: sessionUser }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const rawType = typeof query.type === "string" ? query.type : undefined;
    const type = rawType === "feature" || rawType === "bug" ? rawType : undefined;
    const sort = query.sort === "votes" ? "votes" : "recent";
    const offset = (page - 1) * PAGE_SIZE;

    const conditions = type ? eq(feedback.type, type) : undefined;
    const orderBy = sort === "votes" ? desc(feedback.voteCount) : desc(feedback.createdAt);

    const rows = await db
      .select({
        id: feedback.id,
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
        status: feedback.status,
        voteCount: feedback.voteCount,
        adminNote: feedback.adminNote,
        createdAt: feedback.createdAt,
        authorUsername: user.username,
      })
      .from(feedback)
      .leftJoin(user, eq(feedback.authorId, user.id))
      .where(conditions)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset(offset);

    // Check which items the current user has voted on
    const feedbackIds = rows.map((r) => r.id);
    let votedIds: Set<string> = new Set();

    if (feedbackIds.length > 0) {
      const votes = await db
        .select({ feedbackId: feedbackVotes.feedbackId })
        .from(feedbackVotes)
        .where(
          and(
            eq(feedbackVotes.userId, sessionUser.id),
            sql`${feedbackVotes.feedbackId} IN (${sql.join(
              feedbackIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );
      votedIds = new Set(votes.map((v) => v.feedbackId));
    }

    return {
      feedback: rows.map((r) => Object.assign(r, { voted: votedIds.has(r.id) })),
      page,
      pageSize: PAGE_SIZE,
    };
  })

  // ── Submit feedback ───────────────────────────────────────────────────────
  .post("/", async ({ body, user: sessionUser, set }) => {
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await checkUserRateLimit(
      sessionUser.id,
      "feedback:create",
      RATE_LIMIT_FEEDBACK_CREATE.limit,
      RATE_LIMIT_FEEDBACK_CREATE.windowMs,
    );

    const [item] = await db
      .insert(feedback)
      .values({
        authorId: sessionUser.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
      })
      .returning({ id: feedback.id });

    set.status = 201;
    return { id: item!.id };
  })

  // ── Toggle vote ───────────────────────────────────────────────────────────
  .post("/:id/vote", async ({ params, user: sessionUser }) => {
    await checkUserRateLimit(
      sessionUser.id,
      "feedback:vote",
      RATE_LIMIT_FEEDBACK_VOTE.limit,
      RATE_LIMIT_FEEDBACK_VOTE.windowMs,
    );

    const [item] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, params.id))
      .limit(1);
    if (!item) throw new NotFoundError("Feedback");

    // Check if already voted
    const [existingVote] = await db
      .select({ id: feedbackVotes.id })
      .from(feedbackVotes)
      .where(
        and(
          eq(feedbackVotes.feedbackId, params.id),
          eq(feedbackVotes.userId, sessionUser.id),
        ),
      )
      .limit(1);

    if (existingVote) {
      await db.transaction(async (tx) => {
        await tx.delete(feedbackVotes).where(eq(feedbackVotes.id, existingVote.id));
        await tx
          .update(feedback)
          .set({ voteCount: sql`${feedback.voteCount} - 1` })
          .where(eq(feedback.id, params.id));
      });
      return { voted: false };
    } else {
      await db.transaction(async (tx) => {
        await tx.insert(feedbackVotes).values({
          feedbackId: params.id,
          userId: sessionUser.id,
        });
        await tx
          .update(feedback)
          .set({ voteCount: sql`${feedback.voteCount} + 1` })
          .where(eq(feedback.id, params.id));
      });
      return { voted: true };
    }
  })

  // ── My submissions ────────────────────────────────────────────────────────
  .get("/mine", async ({ user: sessionUser }) => {
    const rows = await db
      .select({
        id: feedback.id,
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
        status: feedback.status,
        voteCount: feedback.voteCount,
        adminNote: feedback.adminNote,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.authorId, sessionUser.id))
      .orderBy(desc(feedback.createdAt));

    return { feedback: rows };
  });
