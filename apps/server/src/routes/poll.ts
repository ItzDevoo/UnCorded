import { Elysia } from "elysia";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  ValidationError,
  NotFoundError,
  RATE_LIMIT_POLL_VOTE,
  RATE_LIMIT_POLL_ACTIVE,
  pollVoteRequestSchema,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import { polls, pollEntries, pollVotes, feedback } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { validateInput } from "../helpers/validation.js";

export const pollRoutes = new Elysia({ prefix: "/api/polls" })
  .resolve(authResolve())

  // ── Get active poll ────────────────────────────────────────────────────────
  .get("/active", async ({ user: sessionUser }) => {
    await checkUserRateLimit(
      sessionUser.id,
      RL.POLL_ACTIVE,
      RATE_LIMIT_POLL_ACTIVE.limit,
      RATE_LIMIT_POLL_ACTIVE.windowMs,
    );

    const [activePoll] = await db
      .select({ id: polls.id, createdAt: polls.createdAt })
      .from(polls)
      .where(isNull(polls.closedAt))
      .limit(1);

    if (!activePoll) {
      return { poll: null };
    }

    // Get entries with feedback details
    const entries = await db
      .select({
        feedbackId: pollEntries.feedbackId,
        title: feedback.title,
        description: feedback.description,
      })
      .from(pollEntries)
      .innerJoin(feedback, eq(pollEntries.feedbackId, feedback.id))
      .where(eq(pollEntries.pollId, activePoll.id));

    // Count votes per entry
    const voteCounts = await db
      .select({
        feedbackId: pollVotes.feedbackId,
        count: sql<number>`count(*)::int`,
      })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, activePoll.id))
      .groupBy(pollVotes.feedbackId);

    const voteMap = new Map(voteCounts.map((v) => [v.feedbackId, v.count]));

    // Check if user has voted
    const [userVote] = await db
      .select({ feedbackId: pollVotes.feedbackId })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, activePoll.id), eq(pollVotes.userId, sessionUser.id)))
      .limit(1);

    const hasVoted = !!userVote;
    const totalVotes = voteCounts.reduce((sum, v) => sum + v.count, 0);

    return {
      poll: {
        id: activePoll.id,
        createdAt: activePoll.createdAt.toISOString(),
        entries: entries.map((e) => ({
          feedbackId: e.feedbackId,
          title: e.title,
          description: e.description,
          votes: hasVoted ? (voteMap.get(e.feedbackId) ?? 0) : null,
        })),
        totalVotes: hasVoted ? totalVotes : null,
        userVote: userVote?.feedbackId ?? null,
      },
    };
  })

  // ── Cast a vote ────────────────────────────────────────────────────────────
  .post("/:id/vote", async ({ params, body, user: sessionUser }) => {
    await checkUserRateLimit(
      sessionUser.id,
      RL.POLL_VOTE,
      RATE_LIMIT_POLL_VOTE.limit,
      RATE_LIMIT_POLL_VOTE.windowMs,
    );

    const { feedbackId: voteFeedbackId } = validateInput(pollVoteRequestSchema, body);

    // Validate poll, entry, and existing vote inside a single transaction
    await db.transaction(async (tx) => {
      const [poll] = await tx
        .select({ id: polls.id, closedAt: polls.closedAt })
        .from(polls)
        .where(eq(polls.id, params.id))
        .limit(1);
      if (!poll) throw new NotFoundError("Poll");
      if (poll.closedAt) throw new ValidationError("Poll is closed");

      const [entry] = await tx
        .select({ feedbackId: pollEntries.feedbackId })
        .from(pollEntries)
        .where(and(eq(pollEntries.pollId, params.id), eq(pollEntries.feedbackId, voteFeedbackId)))
        .limit(1);
      if (!entry) throw new ValidationError("Invalid poll entry");

      const [existingVote] = await tx
        .select({ id: pollVotes.id })
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, params.id), eq(pollVotes.userId, sessionUser.id)))
        .limit(1);
      if (existingVote) throw new ValidationError("You have already voted");

      try {
        await tx.insert(pollVotes).values({
          pollId: params.id,
          userId: sessionUser.id,
          feedbackId: voteFeedbackId,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("poll_vote_unique")) {
          throw new ValidationError("You have already voted");
        }
        throw err;
      }
    });

    // Return updated counts
    const voteCounts = await db
      .select({
        feedbackId: pollVotes.feedbackId,
        count: sql<number>`count(*)::int`,
      })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, params.id))
      .groupBy(pollVotes.feedbackId);

    const voteMap = new Map(voteCounts.map((v) => [v.feedbackId, v.count]));
    const totalVotes = voteCounts.reduce((sum, v) => sum + v.count, 0);

    return {
      votes: Object.fromEntries(voteMap),
      totalVotes,
    };
  });
