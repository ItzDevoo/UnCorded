import { Elysia } from "elysia";
import {
  Opcode,
  CloseCode,
  encode,
  decode,
  typingStartRequestSchema,
  webRtcSignalRequestSchema,
  fileShareRequestSchema,
  fileAvailabilityRequestSchema,
  presenceUpdateSchema,
  fileSessionCreateRequestSchema,
  fileSessionJoinRequestSchema,
  fileSessionProgressRequestSchema,
  fileSessionCompleteRequestSchema,
  fileSessionCloseRequestSchema,
  fileSessionLeaveRequestSchema,
} from "@uncorded/protocol";
import {
  createId,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  RATE_LIMIT_TYPING_START,
  RATE_LIMIT_FILE_SHARE,
  RATE_LIMIT_FILE_AVAILABILITY,
  RATE_LIMIT_WEBRTC,
  RATE_LIMIT_PRESENCE_UPDATE,
  RATE_LIMIT_FILE_SESSION,
  RATE_LIMIT_FILE_SESSION_PROGRESS,
} from "@uncorded/shared";
import { checkRateLimit } from "./rate-limit.js";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, messages, fileReceipts, dmMembers, channels } from "../db/schema.js";
import { removeConnection, sendToUser, broadcastToServer, broadcastToDm } from "./connections.js";
import { handleIdentify } from "./handlers.js";
import { removeUserFromAllServers } from "./server-members.js";
import { resolveChannelMembership } from "../helpers/resolve-channel.js";
import { resetIdleTimer, cleanupPresence, broadcastPresence } from "./presence.js";
import {
  handleFileSessionCreate,
  handleFileSessionJoin,
  handleFileSessionProgress,
  handleFileSessionComplete,
  handleFileSessionClose,
  handleFileSessionLeave,
  cleanupSessionsForUser,
} from "./file-sessions.js";

const FREE_TIER = "free" as const;

interface WsContext {
  userId: string | null;
  username: string | null;
  subscriptionTier: string;
  heartbeatTimeout: Timer | null;
}

const wsContexts = new WeakMap<object, WsContext>();

function getCtx(ws: { raw: object }): WsContext {
  let ctx = wsContexts.get(ws.raw);
  if (!ctx) {
    ctx = { userId: null, username: null, subscriptionTier: "free", heartbeatTimeout: null };
    wsContexts.set(ws.raw, ctx);
  }
  return ctx;
}

function resetHeartbeatTimeout(ws: { raw: object; terminate: () => void }): void {
  const ctx = getCtx(ws);
  if (ctx.heartbeatTimeout) clearTimeout(ctx.heartbeatTimeout);
  ctx.heartbeatTimeout = setTimeout(() => {
    ws.terminate();
  }, HEARTBEAT_TIMEOUT_MS);
}

export const gateway = new Elysia().ws("/gateway", {
  open(ws) {
    ws.send(
      Buffer.from(encode({ op: Opcode.HELLO, d: { heartbeatInterval: HEARTBEAT_INTERVAL_MS } })),
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
          ctx.username = result.username;
          ctx.subscriptionTier = result.subscriptionTier;
          resetHeartbeatTimeout(ws);
          break;
        }

        case Opcode.HEARTBEAT: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }
          resetHeartbeatTimeout(ws);
          ws.send(Buffer.from(encode({ op: Opcode.HEARTBEAT_ACK, d: null })));
          break;
        }

        case Opcode.TYPING_START: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_TYPING_START.limit,
              RATE_LIMIT_TYPING_START.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many typing events" },
            });
            break;
          }

          const parsed = typingStartRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          resetIdleTimer(ctx.userId);

          const typingFrame = {
            op: Opcode.TYPING_START,
            d: { channelId: d.channelId, userId: ctx.userId, username: ctx.username },
          } as const;

          if (resolution.type === "server") {
            broadcastToServer(resolution.serverId, typingFrame, ctx.userId);
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

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_WEBRTC.limit,
              RATE_LIMIT_WEBRTC.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many WebRTC signals" },
            });
            break;
          }

          const parsed = webRtcSignalRequestSchema.safeParse(frame.d);
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

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_FILE_SHARE.limit,
              RATE_LIMIT_FILE_SHARE.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many file shares" },
            });
            break;
          }

          const parsed = fileShareRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          // Sanitize file metadata
          // eslint-disable-next-line no-control-regex
          const sanitizedFileName = d.fileName.replace(/[/\\<>:"|?*\x00-\x1F]/g, "_");

          const resolution = await resolveChannelMembership(ctx.userId, d.channelId);
          if (!resolution) break;

          // Free users cannot share files in server channels (DM sharing is always P2P/free)
          // Note: subscriptionTier is cached from IDENTIFY — may be stale if changed via webhook
          // between sessions. Acceptable trade-off: user reconnects to pick up tier changes.
          if (resolution.type === "server") {
            if (ctx.subscriptionTier === FREE_TIER) {
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

            // Check if file sharing is enabled for this channel
            const [channelRow] = await db
              .select({ fileSharingEnabled: channels.fileSharingEnabled })
              .from(channels)
              .where(eq(channels.id, d.channelId))
              .limit(1);

            if (channelRow && !channelRow.fileSharingEnabled) {
              sendToUser(ctx.userId, {
                op: Opcode.ERROR,
                d: {
                  code: "FILE_SHARING_DISABLED",
                  message: "File sharing is disabled in this channel",
                  channelId: d.channelId,
                },
              });
              break;
            }
          }

          resetIdleTimer(ctx.userId);

          // Create a message for the file share so it appears in chat history
          const msgId = createId();
          const [insertedMsg] = await db
            .insert(messages)
            .values({
              id: msgId,
              channelId: d.channelId,
              authorId: ctx.userId,
              content: null,
            })
            .returning();

          // Insert file receipt linked to the message
          const receiptId = createId();
          await db.insert(fileReceipts).values({
            id: receiptId,
            channelId: d.channelId,
            senderId: ctx.userId,
            fileName: sanitizedFileName,
            fileSize: d.fileSize,
            contentType: d.contentType,
            magnetUri: d.magnetUri,
            infoHash: d.infoHash,
            messageId: msgId,
          });

          // Fetch author info for the message broadcast
          const [author] = await db
            .select({
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              isBot: user.isBot,
            })
            .from(user)
            .where(eq(user.id, ctx.userId))
            .limit(1);

          // Broadcast message with file receipt attached
          const messageFrame = {
            op: Opcode.MESSAGE_CREATE,
            d: {
              id: msgId,
              channelId: d.channelId,
              content: null,
              editedAt: null,
              createdAt: insertedMsg!.createdAt.toISOString(),
              author: author
                ? {
                    id: author.id,
                    username: author.username,
                    displayName: author.displayName,
                    avatarUrl: author.avatarUrl,
                    isBot: author.isBot,
                  }
                : {
                    id: ctx.userId,
                    username: null,
                    displayName: null,
                    avatarUrl: null,
                    isBot: false,
                  },
              fileReceipt: {
                id: receiptId,
                fileName: sanitizedFileName,
                fileSize: d.fileSize,
                contentType: d.contentType,
                magnetUri: d.magnetUri,
                infoHash: d.infoHash,
              },
            },
          } as const;

          // Also send FILE_SHARE for the file store (seeder tracking etc.)
          const shareFrame = {
            op: Opcode.FILE_SHARE,
            d: {
              fileReceiptId: receiptId,
              channelId: d.channelId,
              senderId: ctx.userId,
              fileName: sanitizedFileName,
              fileSize: d.fileSize,
              contentType: d.contentType,
              magnetUri: d.magnetUri,
              infoHash: d.infoHash,
            },
          } as const;

          if (resolution.type === "server") {
            broadcastToServer(resolution.serverId, messageFrame);
            broadcastToServer(resolution.serverId, shareFrame);
          } else {
            // Exclude sender from MESSAGE_CREATE (same as regular messages)
            // then send to self so all tabs get it
            await broadcastToDm(d.channelId, messageFrame, ctx.userId);
            sendToUser(ctx.userId, messageFrame);
            await broadcastToDm(d.channelId, shareFrame, ctx.userId);
            sendToUser(ctx.userId, shareFrame);
          }
          break;
        }

        case Opcode.FILE_AVAILABILITY_UPDATE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_FILE_AVAILABILITY.limit,
              RATE_LIMIT_FILE_AVAILABILITY.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many availability updates" },
            });
            break;
          }

          const parsed = fileAvailabilityRequestSchema.safeParse(frame.d);
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
            broadcastToServer(resolution.serverId, availFrame);
          } else {
            await broadcastToDm(d.channelId, availFrame, ctx.userId);
          }
          break;
        }

        case Opcode.PRESENCE_UPDATE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_PRESENCE_UPDATE.limit,
              RATE_LIMIT_PRESENCE_UPDATE.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many presence updates" },
            });
            break;
          }

          const parsed = presenceUpdateSchema.safeParse(frame.d);
          if (!parsed.success) break;
          const d = parsed.data;

          resetIdleTimer(ctx.userId);

          await db.update(user).set({ status: d.status }).where(eq(user.id, ctx.userId));
          await broadcastPresence(ctx.userId, d.status);
          break;
        }

        // ── File Share Sessions ─────────────────────────────────────────────

        case Opcode.FILE_SESSION_CREATE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_FILE_SESSION.limit,
              RATE_LIMIT_FILE_SESSION.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many file session requests" },
            });
            break;
          }

          const parsed = fileSessionCreateRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          resetIdleTimer(ctx.userId);
          await handleFileSessionCreate(ctx.userId, parsed.data);
          break;
        }

        case Opcode.FILE_SESSION_JOIN: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_FILE_SESSION.limit,
              RATE_LIMIT_FILE_SESSION.windowMs,
            ))
          ) {
            sendToUser(ctx.userId, {
              op: Opcode.ERROR,
              d: { code: "RATE_LIMITED", message: "Too many file session requests" },
            });
            break;
          }

          const parsed = fileSessionJoinRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          resetIdleTimer(ctx.userId);
          await handleFileSessionJoin(ctx.userId, parsed.data);
          break;
        }

        case Opcode.FILE_SESSION_PROGRESS: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          if (
            !(await checkRateLimit(
              ctx.userId,
              frame.op,
              RATE_LIMIT_FILE_SESSION_PROGRESS.limit,
              RATE_LIMIT_FILE_SESSION_PROGRESS.windowMs,
            ))
          ) {
            break; // Silent drop for progress — high frequency
          }

          const parsed = fileSessionProgressRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          handleFileSessionProgress(ctx.userId, parsed.data);
          break;
        }

        case Opcode.FILE_SESSION_COMPLETE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = fileSessionCompleteRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          await handleFileSessionComplete(ctx.userId, parsed.data);
          break;
        }

        case Opcode.FILE_SESSION_CLOSE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = fileSessionCloseRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          handleFileSessionClose(ctx.userId, parsed.data);
          break;
        }

        case Opcode.FILE_SESSION_LEAVE: {
          if (!ctx.userId) {
            ws.close(CloseCode.NOT_IDENTIFIED, "Not identified");
            return;
          }

          const parsed = fileSessionLeaveRequestSchema.safeParse(frame.d);
          if (!parsed.success) break;

          handleFileSessionLeave(ctx.userId, parsed.data);
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
      const wasLast = removeConnection(ctx.userId, ws.raw);

      if (wasLast) {
        cleanupPresence(ctx.userId);
        cleanupSessionsForUser(ctx.userId);
        await db.update(user).set({ status: "offline" }).where(eq(user.id, ctx.userId));
        await broadcastPresence(ctx.userId, "offline");
        removeUserFromAllServers(ctx.userId);
      }
    }

    wsContexts.delete(ws.raw);
  },
});
