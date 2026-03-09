import { Elysia } from "elysia";
import { z } from "zod";
import { Opcode, CloseCode, encode, decode } from "@uncorded/protocol";
import { createId } from "@uncorded/shared";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, channels, members, fileReceipts } from "../db/schema.js";
import { removeConnection, getConnections, sendToUser, broadcastToServer } from "./connections.js";
import { handleIdentify } from "./handlers.js";

const typingStartSchema = z.object({ channelId: z.string() });

const webRtcSignalSchema = z.object({
  targetUserId: z.string(),
  channelId: z.string(),
  data: z.unknown(),
});

const fileShareSchema = z.object({
  channelId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  contentType: z.string().min(1).max(127),
  magnetUri: z.string().min(1).max(2048).startsWith("magnet:"),
  infoHash: z.string().min(1).max(128),
});

const fileAvailabilitySchema = z.object({
  fileReceiptId: z.string(),
  channelId: z.string(),
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
      frame = decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer));
    } catch {
      ws.close(CloseCode.INVALID_FRAME, "Invalid MessagePack frame");
      return;
    }

    const ctx = getCtx(ws);

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

        const [ch] = await db
          .select({ serverId: channels.serverId })
          .from(channels)
          .where(eq(channels.id, d.channelId))
          .limit(1);
        if (!ch) break;

        const [mem] = await db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, ctx.userId), eq(members.serverId, ch.serverId)))
          .limit(1);
        if (!mem) break;

        const [usr] = await db
          .select({ username: user.username })
          .from(user)
          .where(eq(user.id, ctx.userId))
          .limit(1);

        await broadcastToServer(
          ch.serverId,
          {
            op: Opcode.TYPING_START,
            d: { channelId: d.channelId, userId: ctx.userId, username: usr?.username ?? null },
          },
          ctx.userId,
        );
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

        // Validate channel membership
        const [sigCh] = await db
          .select({ serverId: channels.serverId })
          .from(channels)
          .where(eq(channels.id, d.channelId))
          .limit(1);
        if (!sigCh) break;

        const [sigMem] = await db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, ctx.userId), eq(members.serverId, sigCh.serverId)))
          .limit(1);
        if (!sigMem) break;

        // Validate target user is also a member of the same server
        const [targetMem] = await db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, d.targetUserId), eq(members.serverId, sigCh.serverId)))
          .limit(1);
        if (!targetMem) break;

        // Forward to target peer with sender info (silently drop if offline).
        // Cast is safe: we're inside the combined OFFER/ANSWER/ICE_CANDIDATE case,
        // so frame.op is one of these three opcodes, but TS can't narrow a union
        // switch case to a single variant.
        sendToUser(d.targetUserId, {
          op: frame.op as Opcode,
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

        // Validate channel membership
        const [fsCh] = await db
          .select({ serverId: channels.serverId })
          .from(channels)
          .where(eq(channels.id, d.channelId))
          .limit(1);
        if (!fsCh) break;

        const [fsMem] = await db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, ctx.userId), eq(members.serverId, fsCh.serverId)))
          .limit(1);
        if (!fsMem) break;

        // Free users cannot share files in server channels (DM sharing is always allowed,
        // but DM channels use dm_channels table, not channels — so this lookup implicitly
        // filters to server channels only)
        const [fsUser] = await db
          .select({ subscriptionTier: user.subscriptionTier })
          .from(user)
          .where(eq(user.id, ctx.userId))
          .limit(1);
        if (!fsUser || fsUser.subscriptionTier === "free") break;

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

        // Broadcast to all server members — broadcastToServer() is correct here because
        // there are no per-channel permissions yet. The payload includes channelId so
        // clients filter to the relevant channel view.
        await broadcastToServer(fsCh.serverId, {
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
        });
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

        // Validate channel membership
        const [faCh] = await db
          .select({ serverId: channels.serverId })
          .from(channels)
          .where(eq(channels.id, d.channelId))
          .limit(1);
        if (!faCh) break;

        const [faMem] = await db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, ctx.userId), eq(members.serverId, faCh.serverId)))
          .limit(1);
        if (!faMem) break;

        // Broadcast to all server members (see FILE_SHARE comment — no per-channel perms yet)
        await broadcastToServer(faCh.serverId, {
          op: Opcode.FILE_AVAILABILITY_UPDATE,
          d: {
            fileReceiptId: d.fileReceiptId,
            channelId: d.channelId,
            userId: ctx.userId,
            available: d.available,
          },
        });
        break;
      }

      default:
        break;
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
