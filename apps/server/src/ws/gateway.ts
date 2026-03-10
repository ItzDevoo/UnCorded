import { Elysia } from "elysia";
import { z } from "zod";
import { Opcode, CloseCode, encode, decode } from "@uncorded/protocol";
import {
  createId,
  MAX_FILE_SIZE_BYTES,
  MAX_SDP_SIZE,
  MAX_FILE_NAME_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
  MAX_MAGNET_URI_LENGTH,
  MAX_INFO_HASH_LENGTH,
} from "@uncorded/shared";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, fileReceipts, dmMembers } from "../db/schema.js";
import {
  removeConnection,
  getConnections,
  sendToUser,
  broadcastToServer,
  broadcastToDm,
} from "./connections.js";
import { handleIdentify } from "./handlers.js";
import { resolveChannelMembership } from "../helpers/resolve-channel.js";

const FREE_TIER = "free" as const;

const typingStartSchema = z.object({ channelId: z.string().min(1) });

const webRtcSignalSchema = z.object({
  targetUserId: z.string().min(1),
  channelId: z.string().min(1),
  data: z.union([
    z.string().max(MAX_SDP_SIZE),
    z
      .record(z.string(), z.unknown())
      .refine((r) => JSON.stringify(r).length <= MAX_SDP_SIZE, "ICE candidate too large"),
  ]),
});

const fileShareSchema = z.object({
  channelId: z.string().min(1),
  fileName: z.string().min(1).max(MAX_FILE_NAME_LENGTH),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  contentType: z.string().min(1).max(MAX_CONTENT_TYPE_LENGTH),
  magnetUri: z.string().min(1).max(MAX_MAGNET_URI_LENGTH).startsWith("magnet:"),
  infoHash: z.string().min(1).max(MAX_INFO_HASH_LENGTH),
});

const fileAvailabilitySchema = z.object({
  fileReceiptId: z.string().min(1),
  channelId: z.string().min(1),
  available: z.boolean(),
});

const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 45_000;

interface WsContext {
  userId: string | null;
  heartbeatTimeout: Timer | null;
}

const wsContexts = new WeakMap<object, WsContext>();

function getCtx(ws: { raw: object }): WsContext {
  let ctx = wsContexts.get(ws.raw);
  if (!ctx) {
    ctx = { userId: null, heartbeatTimeout: null };
    wsContexts.set(ws.raw, ctx);
  }
  return ctx;
}

function resetHeartbeatTimeout(ws: { raw: object; terminate: () => void }): void {
  const ctx = getCtx(ws);
  if (ctx.heartbeatTimeout) clearTimeout(ctx.heartbeatTimeout);
  ctx.heartbeatTimeout = setTimeout(() => {
    ws.terminate();
  }, HEARTBEAT_TIMEOUT);
}

export const gateway = new Elysia().ws("/gateway", {
  open(ws) {
    ws.send(
      Buffer.from(encode({ op: Opcode.HELLO, d: { heartbeatInterval: HEARTBEAT_INTERVAL } })),
    );
    resetHeartbeatTimeout(ws);
  },

  async message(ws, raw) {
    if (typeof raw === "string") {
      ws.close(CloseCode.NOT_BINARY, "Expected binary MessagePack");
      return;
    }

    let frame: { op: number; d: unknown };
    try {
      const bytes =
        raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : null;
      if (!bytes) return;
      frame = decode(bytes);
    } catch {
      ws.close(CloseCode.INVALID_FRAME, "Invalid MessagePack frame");
      return;
    }

    const ctx = getCtx(ws);

    try {
      switch (frame.op) {
        case Opcode.IDENTIFY: {
          if (ctx.userId) {
            ws.close(CloseCode.ALREADY_IDENTIFIED, "Already identified");
            return;
          }

          const result = await handleIdentify(ws.raw, frame.d);
          if (!result.success) {
            ws.close(result.closeCode, result.closeReason);
            return;
          }

          ctx.userId = result.userId;
          resetHeartbeatTimeout(ws);
          break;
        }

        case Opcode.HEARTBEAT: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }
          resetHeartbeatTimeout(ws);
          break;
        }

        case Opcode.TYPING_START: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = typingStartSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          const [usr] = await db
            .select({ username: user.username })
            .from(user)
            .where(eq(user.id, ctx.userId))
            .limit(1);

          const typingFrame = {
            op: Opcode.TYPING_START,
            d: { channelId: d.channelId, userId: ctx.userId, username: usr?.username ?? null },
          } as const;

          if (resolution.type === "server") {
            await broadcastToServer(resolution.serverId, typingFrame, ctx.userId);
          } else {
            await broadcastToDm(d.channelId, typingFrame, ctx.userId);
          }
          break;
        }

        case Opcode.WEBRTC_OFFER:
        case Opcode.WEBRTC_ANSWER:
        case Opcode.WEBRTC_ICE_CANDIDATE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = webRtcSignalSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          // Validate target user is also a member of the same channel context
          if (resolution.type === "server") {
            const targetResolution = await resolveChannelMembership(d.targetUserId, d.channelId);
            if (!targetResolution) break;
          } else {
            // DM: verify target is a member of this DM channel
            const [targetDm] = await db
              .select({ channelId: dmMembers.channelId })
              .from(dmMembers)
              .where(
                and(eq(dmMembers.channelId, d.channelId), eq(dmMembers.userId, d.targetUserId)),
              )
              .limit(1);
            if (!targetDm) break;
          }

          // Forward to target peer with sender info (silently drop if offline).
          // Cast is safe: we're inside the combined OFFER/ANSWER/ICE_CANDIDATE case,
          // so frame.op is one of these three opcodes, but TS can't narrow a union
          // switch case to a single variant.
          sendToUser(d.targetUserId, {
            op: frame.op as
              | Opcode.WEBRTC_OFFER
              | Opcode.WEBRTC_ANSWER
              | Opcode.WEBRTC_ICE_CANDIDATE,
            d: { fromUserId: ctx.userId, channelId: d.channelId, data: d.data },
          });
          break;
        }

        case Opcode.FILE_SHARE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = fileShareSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          // Free users cannot share files in server channels (DM sharing is always P2P/free)
          if (resolution.type === "server") {
            const [fsUser] = await db
              .select({ subscriptionTier: user.subscriptionTier })
              .from(user)
              .where(eq(user.id, ctx.userId))
              .limit(1);

            if (!fsUser || fsUser.subscriptionTier === FREE_TIER) {
              sendToUser(ctx.userId, {
                op: Opcode.ERROR,
                d: {
                  code: "TIER_RESTRICTED",
                  message: "File sharing in server channels requires a Supporter subscription",
                  channelId: d.channelId,
                },
              });
              break;
            }
          }

          // Insert file receipt
          const receiptId = createId();
          await db.insert(fileReceipts).values({
            id: receiptId,
            channelId: d.channelId,
            senderId: ctx.userId,
            fileName: d.fileName,
            fileSize: d.fileSize,
            contentType: d.contentType,
            magnetUri: d.magnetUri,
            infoHash: d.infoHash,
          });

          const shareFrame = {
            op: Opcode.FILE_SHARE,
            d: {
              fileReceiptId: receiptId,
              channelId: d.channelId,
              senderId: ctx.userId,
              fileName: d.fileName,
              fileSize: d.fileSize,
              contentType: d.contentType,
              magnetUri: d.magnetUri,
              infoHash: d.infoHash,
            },
          } as const;

          if (resolution.type === "server") {
            await broadcastToServer(resolution.serverId, shareFrame);
          } else {
            await broadcastToDm(d.channelId, shareFrame);
          }
          break;
        }

        case Opcode.FILE_AVAILABILITY_UPDATE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = fileAvailabilitySchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          const availFrame = {
            op: Opcode.FILE_AVAILABILITY_UPDATE,
            d: {
              fileReceiptId: d.fileReceiptId,
              channelId: d.channelId,
              userId: ctx.userId,
              available: d.available,
            },
          } as const;

          if (resolution.type === "server") {
            await broadcastToServer(resolution.serverId, availFrame);
          } else {
            await broadcastToDm(d.channelId, availFrame);
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error(
        "[gateway] Unexpected error:",
        err instanceof Error ? err.message : String(err),
      );
      if (err instanceof Error && err.stack) console.error(err.stack);
      if (ctx.userId) {
        sendToUser(ctx.userId, {
          op: Opcode.ERROR,
          d: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        });
      }
    }
  },

  async close(ws) {
    const ctx = getCtx(ws);
    if (ctx.heartbeatTimeout) clearTimeout(ctx.heartbeatTimeout);

    if (ctx.userId) {
      removeConnection(ctx.userId, ws.raw);

      // If no more connections for this user, set offline
      const remaining = getConnections(ctx.userId);
      if (!remaining) {
        await db.update(user).set({ status: "offline" }).where(eq(user.id, ctx.userId));
      }
    }

    wsContexts.delete(ws.raw);
  },
});
