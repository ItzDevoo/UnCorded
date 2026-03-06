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
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ─── Helpers ─────────────────────────────────────────────

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => nanoid());

const createdAt = () =>
  timestamp('created_at', { mode: 'date' }).defaultNow().notNull();

const updatedAt = () =>
  timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

// ─── Enums ───────────────────────────────────────────────

export const userStatusEnum = pgEnum('user_status', ['online', 'idle', 'dnd', 'offline']);

export const channelTypeEnum = pgEnum('channel_type', ['text', 'category']);

export const storagePolicyEnum = pgEnum('storage_policy', [
  'ephemeral',
  'extended',
  'persistent',
]);

export const friendshipStatusEnum = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'blocked',
]);

export const purchaseItemEnum = pgEnum('purchase_item', ['custom_avatar', 'extended_expiry']);

export const purchaseStatusEnum = pgEnum('purchase_status', ['active', 'cancelled']);

export const reportCategoryEnum = pgEnum('report_category', [
  'csam',
  'harassment',
  'spam',
  'copyright',
  'malware',
  'other',
]);

// ─── Better Auth Core Tables ─────────────────────────────
// Better Auth manages session, account, verification tables automatically.
// We define the user table with our custom fields so Drizzle knows the schema.

export const user = pgTable('user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),

  // Username plugin fields
  username: text('username').unique(),
  displayUsername: text('display_username'),

  // Custom app fields
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  status: userStatusEnum('status').default('offline').notNull(),
  hasExtendedExpiry: boolean('has_extended_expiry').default(false).notNull(),
  hasCustomAvatar: boolean('has_custom_avatar').default(false).notNull(),
});

export const session = pgTable(
  'session',
  {
    id: id(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: id(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ─── App Tables ──────────────────────────────────────────

export const servers = pgTable('servers', {
  id: id(),
  name: text('name').notNull(),
  iconUrl: text('icon_url'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
});

export const channels = pgTable('channels', {
  id: id(),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: channelTypeEnum('type').default('text').notNull(),
  storagePolicy: storagePolicyEnum('storage_policy').default('ephemeral').notNull(),
  position: integer('position').default(0).notNull(),
  topic: text('topic'),
  createdAt: createdAt(),
});

// messages.channel_id has NO foreign key.
// DM messages reference dm_channels, not channels.
// A FK to channels(id) would break DM functionality.
// Validate channel ownership in application logic instead.
export const messages = pgTable(
  'messages',
  {
    id: id(),
    channelId: text('channel_id').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id),
    content: text('content'),
    editedAt: timestamp('edited_at', { mode: 'date' }),
    createdAt: createdAt(),
  },
  (t) => [index('messages_channel_created_idx').on(t.channelId, t.createdAt.desc())],
);

export const attachments = pgTable('attachments', {
  id: id(),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  url: text('url').notNull(),
  fileKey: text('file_key').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull(),
  width: integer('width'),
  height: integer('height'),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  expired: boolean('expired').default(false).notNull(),
});

export const members = pgTable(
  'members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    nickname: text('nickname'),
    joinedAt: timestamp('joined_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.serverId] })],
);

export const roles = pgTable('roles', {
  id: id(),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  permissions: bigint('permissions', { mode: 'number' }).default(sql`0`).notNull(),
  position: integer('position').default(0).notNull(),
});

export const memberRoles = pgTable(
  'member_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.serverId, t.roleId] })],
);

export const friendships = pgTable(
  'friendships',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    friendId: text('friend_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').default('pending').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] })],
);

export const dmChannels = pgTable('dm_channels', {
  id: id(),
  createdAt: createdAt(),
});

export const dmMembers = pgTable(
  'dm_members',
  {
    channelId: text('channel_id')
      .notNull()
      .references(() => dmChannels.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.userId] })],
);

export const invites = pgTable('invites', {
  code: text('code')
    .primaryKey()
    .$defaultFn(() => nanoid(8)),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id),
  uses: integer('uses').default(0).notNull(),
  maxUses: integer('max_uses'),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
});

export const purchases = pgTable('purchases', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  item: purchaseItemEnum('item').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  status: purchaseStatusEnum('status').default('active').notNull(),
  currentPeriodEnd: timestamp('current_period_end', { mode: 'date' }),
  createdAt: createdAt(),
});

export const reports = pgTable('reports', {
  id: id(),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => user.id),
  messageId: text('message_id').references(() => messages.id),
  attachmentId: text('attachment_id').references(() => attachments.id),
  category: reportCategoryEnum('category').notNull(),
  details: text('details'),
  resolved: boolean('resolved').default(false).notNull(),
  createdAt: createdAt(),
});
