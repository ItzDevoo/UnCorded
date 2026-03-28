import { z } from "zod";

// ── Dashboard Stats ──────────────────────────────────

export const statsSchema = z.object({
  totalUsers: z.number(),
  totalServers: z.number(),
  totalMessages: z.number(),
  unresolvedReports: z.number(),
  openFeedback: z.number(),
});

export type Stats = z.infer<typeof statsSchema>;

// ── Audit Log ────────────────────────────────────────

export const auditEntrySchema = z.object({
  id: z.string(),
  adminId: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  details: z.string().nullable(),
  createdAt: z.string(),
  adminUsername: z.string().nullable(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type AuditResponse = z.infer<typeof auditResponseSchema>;

// ── Reports ──────────────────────────────────────────

export const reportRowSchema = z.object({
  id: z.string(),
  reporterId: z.string().nullable(),
  type: z.string(),
  messageId: z.string().nullable(),
  fileReceiptId: z.string().nullable(),
  targetUserId: z.string().nullable(),
  serverId: z.string().nullable(),
  category: z.string(),
  details: z.string().nullable(),
  resolved: z.boolean(),
  createdAt: z.string(),
  reporterUsername: z.string().nullable(),
  targetUsername: z.string().nullable(),
  serverName: z.string().nullable(),
});

export type ReportRow = z.infer<typeof reportRowSchema>;

export const reportsResponseSchema = z.object({
  reports: z.array(reportRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type ReportsResponse = z.infer<typeof reportsResponseSchema>;

// ── Feedback ────────────────────────────────────────

export const feedbackRowSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  voteCount: z.number(),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  authorUsername: z.string().nullable(),
});

export type FeedbackRow = z.infer<typeof feedbackRowSchema>;

export const feedbackResponseSchema = z.object({
  feedback: z.array(feedbackRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

// ── Admins ──────────────────────────────────────────

export type AdminLevel = "owner" | "admin";

export const adminsResponseSchema = z.object({
  admins: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    level: z.string(),
    addedAt: z.string(),
    username: z.string().nullable(),
    email: z.string().nullable(),
  })),
});

export type AdminsResponse = z.infer<typeof adminsResponseSchema>;

// ── Users ───────────────────────────────────────────

export const userRowSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  email: z.string(),
  subscriptionTier: z.string().nullable(),
  status: z.string().nullable(),
  banned: z.boolean(),
  createdAt: z.string(),
  giftedTier: z.string().nullable().optional(),
  giftExpiresAt: z.string().nullable().optional(),
  botCount: z.number().optional(),
});

export type UserRow = z.infer<typeof userRowSchema>;

export const usersResponseSchema = z.object({
  users: z.array(userRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type UsersResponse = z.infer<typeof usersResponseSchema>;

// ── User Bots ──────────────────────────────────────

export const userBotRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  username: z.string().nullable(),
  tokenPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type UserBotRow = z.infer<typeof userBotRowSchema>;

export const userBotsResponseSchema = z.object({
  bots: z.array(userBotRowSchema),
});

export type UserBotsResponse = z.infer<typeof userBotsResponseSchema>;

// ── Polls ──────────────────────────────────────────

export const pollEntryRowSchema = z.object({
  feedbackId: z.string(),
  title: z.string(),
  description: z.string(),
  pollVotes: z.number(),
});

export type PollEntryRow = z.infer<typeof pollEntryRowSchema>;

export const pollRowSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  winnerId: z.string().nullable(),
  entries: z.array(pollEntryRowSchema),
  totalVotes: z.number(),
});

export type PollRow = z.infer<typeof pollRowSchema>;

export const pollsResponseSchema = z.object({
  polls: z.array(pollRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PollsResponse = z.infer<typeof pollsResponseSchema>;
