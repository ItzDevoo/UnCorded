import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { nanoid } from "nanoid";

// ─── Helpers ─────────────────────────────────────────────

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const createdAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();

const updatedAt = () =>
  timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

// ─── Enums ───────────────────────────────────────────────

export const userStatusEnum = pgEnum("user_status", ["online", "idle", "dnd", "offline"]);

export const channelTypeEnum = pgEnum("channel_type", ["text", "category"]);

export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted", "blocked"]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "supporter",
  "server_owner",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
]);

export const reportCategoryEnum = pgEnum("report_category", [
  "csam",
  "intimate_image",
  "harassment",
  "spam",
  "copyright",
  "malware",
  "other",
]);

export const reportTypeEnum = pgEnum("report_type", ["message", "file", "player", "server"]);

export const adminLevelEnum = pgEnum("admin_level", ["admin", "owner"]);

export const feedbackTypeEnum = pgEnum("feedback_type", ["feature", "bug"]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "open",
  "in_progress",
  "completed",
  "rejected",
]);

// ─── Better Auth Core Tables ─────────────────────────────
// Better Auth manages session, account, verification tables automatically.
// We define the user table with our custom fields so Drizzle knows the schema.

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),

  // Username plugin fields
  username: text("username").unique(),
  displayUsername: text("display_username"),

  // Custom app fields
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  status: userStatusEnum("status").default("offline").notNull(),
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free").notNull(),
  banned: boolean("banned").default(false).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ─── App Tables ──────────────────────────────────────────

export const servers = pgTable("servers", {
  id: id(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
});

export const channels = pgTable("channels", {
  id: id(),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: channelTypeEnum("type").default("text").notNull(),
  fileSharingEnabled: boolean("file_sharing_enabled").default(true).notNull(),
  position: integer("position").default(0).notNull(),
  topic: text("topic"),
  createdAt: createdAt(),
});

// messages.channel_id has NO foreign key.
// DM messages reference dm_channels, not channels.
// A FK to channels(id) would break DM functionality.
// Validate channel ownership in application logic instead.
export const messages = pgTable(
  "messages",
  {
    id: id(),
    channelId: text("channel_id").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    content: text("content"),
    editedAt: timestamp("edited_at", { mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_channel_created_idx").on(t.channelId, t.createdAt.desc())],
);

export const fileReceipts = pgTable(
  "file_receipts",
  {
    id: id(),
    channelId: text("channel_id").notNull(),
    senderId: text("sender_id").references(() => user.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    magnetUri: text("magnet_uri").notNull(),
    infoHash: text("info_hash").notNull(),
    messageId: text("message_id").references(() => messages.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_file_receipts_channel_id").on(t.channelId),
    unique("uq_file_receipts_message_id").on(t.messageId),
  ],
);

export const members = pgTable(
  "members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    nickname: text("nickname"),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.serverId] })],
);

export const friendships = pgTable(
  "friendships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").default("pending").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] })],
);

export const dmChannels = pgTable("dm_channels", {
  id: id(),
  createdAt: createdAt(),
});

export const dmMembers = pgTable(
  "dm_members",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => dmChannels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("idx_dm_members_user_id").on(t.userId),
  ],
);

export const invites = pgTable(
  "invites",
  {
    code: text("code")
      .primaryKey()
      .$defaultFn(() => nanoid(8)),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    creatorId: text("creator_id").references(() => user.id, { onDelete: "set null" }),
    uses: integer("uses").default(0).notNull(),
    maxUses: integer("max_uses"),
    expiresAt: timestamp("expires_at", { mode: "date" }),
  },
  (t) => [index("idx_invites_server_id").on(t.serverId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: subscriptionTierEnum("tier").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeCustomerId: text("stripe_customer_id"),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_subscriptions_user_id").on(t.userId),
    index("idx_subscriptions_stripe_sub_id").on(t.stripeSubscriptionId),
  ],
);

export const reports = pgTable("reports", {
  id: id(),
  reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
  type: reportTypeEnum("type").notNull(),
  messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
  fileReceiptId: text("file_receipt_id").references(() => fileReceipts.id, {
    onDelete: "set null",
  }),
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  serverId: text("server_id").references(() => servers.id, { onDelete: "set null" }),
  category: reportCategoryEnum("category").notNull(),
  details: text("details"),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: createdAt(),
});

// ─── Admin Tables ───────────────────────────────────────────

export const admins = pgTable("admins", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  level: adminLevelEnum("level").notNull(),
  addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
  addedAt: timestamp("added_at", { mode: "date" }).defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
  id: id(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: feedbackTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: feedbackStatusEnum("status").default("open").notNull(),
  voteCount: integer("vote_count").default(0).notNull(),
  adminNote: text("admin_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const feedbackVotes = pgTable(
  "feedback_votes",
  {
    id: id(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [unique("feedback_vote_unique").on(t.feedbackId, t.userId)],
);

export const giftedSubscriptions = pgTable(
  "gifted_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: subscriptionTierEnum("tier").notNull(),
    giftedBy: text("gifted_by").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_gifted_subscriptions_expires_at").on(t.expiresAt)],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    adminId: text("admin_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: text("details"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt.desc())],
);
