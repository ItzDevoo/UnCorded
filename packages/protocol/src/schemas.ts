import { z } from "zod";
import {
  MAX_SDP_SIZE,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_NAME_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
  MAX_MAGNET_URI_LENGTH,
  MAX_INFO_HASH_LENGTH,
} from "@uncorded/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Accepts both ISO strings and Date objects (MessagePack preserves Dates). */
export const coerceDate = z.union([z.string(), z.date().transform((d) => d.toISOString())]);
export const coerceDateNullable = coerceDate.nullable();

export const authorSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const userProfileSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

export const channelSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string().trim().min(1).max(100),
  type: z.string(),
  position: z.number().int().nonnegative(),
  topic: z.string().nullable(),
  fileSharingEnabled: z.boolean(),
});

// ── Client → Server (request schemas) ────────────────────────────────────────

export const identifyRequestSchema = z.object({ ticket: z.string() });

export const typingStartRequestSchema = z.object({ channelId: z.string().min(1) });

export const webRtcSignalRequestSchema = z.object({
  targetUserId: z.string().min(1),
  channelId: z.string().min(1),
  data: z.union([
    z.string().max(MAX_SDP_SIZE),
    z
      .record(z.string(), z.unknown())
      .refine((r) => JSON.stringify(r).length <= MAX_SDP_SIZE, "ICE candidate too large"),
  ]),
});

export const fileShareRequestSchema = z.object({
  channelId: z.string().min(1),
  fileName: z.string().min(1).max(MAX_FILE_NAME_LENGTH),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  contentType: z.string().min(1).max(MAX_CONTENT_TYPE_LENGTH),
  magnetUri: z.string().min(1).max(MAX_MAGNET_URI_LENGTH).startsWith("magnet:"),
  infoHash: z.string().min(1).max(MAX_INFO_HASH_LENGTH),
});

export const fileAvailabilityRequestSchema = z.object({
  fileReceiptId: z.string().min(1),
  channelId: z.string().min(1),
  available: z.boolean(),
});

// ── Server → Client (event schemas) ─────────────────────────────────────────

export const readyEventSchema = z.object({
  user: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    status: z.string(),
    subscriptionTier: z.string(),
  }),
  servers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      iconUrl: z.string().nullable(),
      ownerId: z.string(),
    }),
  ),
  dmChannels: z
    .array(
      z.object({
        id: z.string(),
        otherUser: userProfileSchema,
      }),
    )
    .default([]),
  hasMoreDmChannels: z.boolean(),
  friends: z
    .array(
      z.object({
        userId: z.string(),
        username: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        status: z.string(),
        friendshipStatus: z.string(),
        incoming: z.boolean(),
      }),
    )
    .default([]),
  hasMoreFriends: z.boolean(),
});

export const messageCreateEventSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  content: z.string().nullable(),
  editedAt: coerceDateNullable,
  createdAt: coerceDate,
  author: authorSchema,
  fileReceipt: z
    .object({
      id: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      contentType: z.string(),
      magnetUri: z.string(),
      infoHash: z.string(),
    })
    .optional(),
});

export const messageUpdateEventSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  content: z.string(),
  editedAt: coerceDateNullable,
});

export const messageDeleteEventSchema = z.object({
  id: z.string(),
  channelId: z.string(),
});

export const typingStartEventSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
});

export const serverCreateEventSchema = z.object({
  server: z.object({
    id: z.string(),
    name: z.string(),
    iconUrl: z.string().nullable(),
    ownerId: z.string(),
  }),
  channels: z.array(channelSchema),
});

export const serverDeleteEventSchema = z.object({
  id: z.string(),
});

export const serverUpdateEventSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  iconUrl: z.string().nullable().optional(),
  ownerId: z.string().optional(),
});

export const channelCreateEventSchema = channelSchema;

export const channelUpdateEventSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string().trim().min(1).max(100).optional(),
  topic: z.string().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
  fileSharingEnabled: z.boolean().optional(),
});

export const channelDeleteEventSchema = z.object({
  id: z.string(),
  serverId: z.string(),
});

export const memberAddEventSchema = z.object({
  serverId: z.string(),
  user: authorSchema,
});

export const memberRemoveEventSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
});

export const friendRequestEventSchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

export const friendAcceptEventSchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

export const friendRemoveEventSchema = z.object({
  userId: z.string(),
});

export const dmChannelCreateEventSchema = z.object({
  id: z.string(),
  otherUser: userProfileSchema,
});

export const fileShareEventSchema = z.object({
  senderId: z.string(),
  fileReceiptId: z.string(),
  channelId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
  magnetUri: z.string(),
  infoHash: z.string(),
});

export const fileAvailabilityEventSchema = z.object({
  fileReceiptId: z.string(),
  channelId: z.string(),
  userId: z.string(),
  available: z.boolean(),
});

export const signalingEventSchema = z.object({
  fromUserId: z.string().min(1),
  channelId: z.string().min(1),
  data: z.unknown(),
});

export const errorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// ── Presence ──────────────────────────────────────────────────────────────────

/** Client → Server: user sets their own status (no "offline" — server controls that). */
export const presenceUpdateSchema = z.object({
  status: z.enum(["online", "idle"]),
});

/** Server → Client: broadcast when any user's presence changes. */
export const presenceUpdateEventSchema = z.object({
  userId: z.string(),
  status: z.enum(["online", "idle", "offline"]),
});
