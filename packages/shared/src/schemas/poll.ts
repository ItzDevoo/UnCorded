import { z } from "zod";

export const activePollEntrySchema = z.object({
  feedbackId: z.string(),
  title: z.string(),
  description: z.string(),
  votes: z.number().nullable(),
});

export type ActivePollEntry = z.infer<typeof activePollEntrySchema>;

export const activePollSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  entries: z.array(activePollEntrySchema),
  totalVotes: z.number().nullable(),
  userVote: z.string().nullable(),
});

export type ActivePoll = z.infer<typeof activePollSchema>;

export const activePollResponseSchema = z.object({
  poll: activePollSchema.nullable(),
});

export type ActivePollResponse = z.infer<typeof activePollResponseSchema>;

export const pollVoteRequestSchema = z.object({
  feedbackId: z.string().min(1),
});

export type PollVoteRequest = z.infer<typeof pollVoteRequestSchema>;

export const pollVoteResponseSchema = z.object({
  votes: z.record(z.string(), z.number()),
  totalVotes: z.number(),
});

export type PollVoteResponse = z.infer<typeof pollVoteResponseSchema>;
