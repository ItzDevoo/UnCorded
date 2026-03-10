# Database Schema

All IDs are nanoid (TEXT). Managed by Drizzle ORM.
Reference: C:\Nexis\apps\server\src\db\schema.ts for implementation patterns.

## Enums

- user_status: online | idle | dnd | offline
- channel_type: text | category
- friendship_status: pending | accepted | blocked
- subscription_tier: free | supporter | server_owner
- subscription_status: active | cancelled | past_due
- report_category: csam | harassment | spam | copyright | malware | other

## Tables

### users

Drizzle export is `user` (singular) to match Better Auth convention.

id, name (required, Better Auth), email (unique), email_verified (bool, default false, Better Auth),
image (nullable, Better Auth), username (unique, nullable — Better Auth username plugin),
display_username (Better Auth username plugin),
display_name, avatar_url,
status (user_status, default offline),
subscription_tier (subscription_tier, default free),
created_at, updated_at
-- name, email_verified, image are required by Better Auth core
-- username, display_username are required by Better Auth username plugin
-- passwords/sessions managed by Better Auth tables
-- session, account, verification are explicitly defined in our schema (required by Drizzle adapter)

### servers

id, name, icon_url, owner_id -> users (restrict — ownership must be transferred before user deletion), created_at

### channels

id, server_id -> servers (cascade), name,
type (channel_type, default text),
file_sharing_enabled (bool, default true),
position (int, default 0), topic, created_at
-- file_sharing_enabled: server owner controls which channels allow file sharing
-- file sharing in channels requires Supporter+ tier to upload/seed

### messages

id, channel_id (TEXT, no FK), author_id -> users (set null, nullable — "[deleted user]"),
content (nullable — null for file-only messages), edited_at (nullable), created_at
-- No FK on channel_id: DM messages reference dm_channels, not channels.
-- A FK to channels(id) would break DM functionality. Validate channel
-- ownership in application logic instead.
INDEX: (channel_id, created_at DESC)

### file_receipts

id, channel_id (TEXT), sender_id -> users (set null, nullable — "[deleted user]"),
file_name, file_size (bigint bytes), content_type,
magnet_uri (TEXT NOT NULL — WebTorrent magnet link, persists in chat),
info_hash (TEXT NOT NULL — torrent info hash for swarm identification),
message_id -> messages (cascade, nullable),
created_at
-- Lightweight record of what was shared. No actual file data stored.
-- magnet_uri is stored as message content or alongside it.
-- info_hash enables swarm coordination and deduplication.

### members

(user_id, server_id) PK, nickname, joined_at
user_id -> users (cascade), server_id -> servers (cascade)

### roles

id, server_id -> servers (cascade), name, color,
permissions (bigint bitfield, default 0), position (int, default 0)

### member_roles

(user_id, server_id, role_id) PK
user_id -> users (cascade), server_id -> servers (cascade), role_id -> roles (cascade)

### friendships

(user_id, friend_id) PK, status (friendship_status, default pending), created_at
user_id -> users (cascade), friend_id -> users (cascade)

### dm_channels

id, created_at

### dm_members

(channel_id, user_id) PK
channel_id -> dm_channels (cascade), user_id -> users (cascade)

### invites

code (PK, nanoid 8 chars), server_id -> servers (cascade),
creator_id -> users (set null, nullable — invite stays functional), uses (int, default 0),
max_uses (nullable, null = unlimited), expires_at (nullable)

### subscriptions

id, user_id -> users (cascade),
tier (subscription_tier enum: free | supporter | server_owner),
stripe_subscription_id (nullable), stripe_customer_id (nullable),
status (subscription_status, default active),
current_period_end (timestamp, nullable), created_at

### reports

id, reporter_id -> users (set null, nullable — moderation data survives user deletion),
message_id -> messages (nullable, on delete set null),
file_receipt_id -> file_receipts (nullable, on delete set null),
category (report_category),
details (text, nullable),
resolved (bool, default false),
created_at

### session (Better Auth managed)

id, expires_at, token, ip_address (nullable), user_agent (nullable),
user_id -> users (cascade),
created_at, updated_at
INDEX: session_user_id_idx (user_id)

### account (Better Auth managed)

id, account_id, provider_id,
user_id -> users (cascade),
access_token (nullable), refresh_token (nullable),
access_token_expires_at (nullable), refresh_token_expires_at (nullable),
scope (nullable), id_token (nullable), password (nullable),
created_at, updated_at
INDEX: account_user_id_idx (user_id)

### verification (Better Auth managed)

id, identifier, value, expires_at,
created_at, updated_at
INDEX: verification_identifier_idx (identifier)

## Migration Notes

- Schema pivot from V1 (R2 ephemeral storage) to V2 (WebTorrent P2P)
- Dropped: attachments table, storage_policy enum, purchase_item enum, purchases table
- Added: file_receipts table, subscription_tier enum, subscriptions table
- Changed: channels.storage_policy -> channels.file_sharing_enabled (bool)
- Changed: users.has_extended_expiry + has_custom_avatar -> users.subscription_tier
- Migration required when implementing these changes in code
