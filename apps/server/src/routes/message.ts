import { Elysia } from "elysia";
import { eq, and, lt, gt, desc, or } from "drizzle-orm";
import { z } from "zod";
import {
  createMessageSchema,
  updateMessageSchema,
  MESSAGE_PAGE_LIMIT,
  MESSAGE_FETCH_MAX_LIMIT,
  RATE_LIMIT_MESSAGE_CREATE,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from "@uncorded/shared";
import { Opcode, messageId, channelId, userId, type UserId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { messages, fileReceipts, servers, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { resolveChannelMembership } from "../helpers/resolve-channel.js";
import { broadcastToServer, broadcastToDm, sendToUser } from "../ws/connections.js";
import { checkUserRateLimit } from "../helpers/rate-limit.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { validateInput } from "../helpers/validation.js";

const DEFAULT_LIMIT = MESSAGE_PAGE_LIMIT;

const listQuerySchema = z.object({
  before: z.string().min(1).optional(),
  after: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGE_FETCH_MAX_LIMIT).optional(),
});

/** Resolve channel membership, throwing typed errors for HTTP routes. */
async function resolveChannel(chanId: string, reqUserId: string) {
  const resolution = await resolveChannelMembership(reqUserId, chanId);
  if (!resolution) throw new NotFoundError("Channel");
  return resolution;
}

const DELETED_AUTHOR = {
  id: null as UserId | null,
  username: "[deleted user]",
  displayName: null as string | null,
  avatarUrl: null as string | null,
  isBot: false,
};

/** Fetch a single message with author info. Uses leftJoin to include messages from deleted users. */
async function fetchMessageWithAuthor(msgId: string) {
  const [row] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      content: messages.content,
      editedAt: messages.editedAt,
      createdAt: messages.createdAt,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isBot: user.isBot,
      },
    })
    .from(messages)
    .leftJoin(user, eq(user.id, messages.authorId))
    .where(eq(messages.id, msgId))
    .limit(1);

  if (!row) return null;
  const author = row.author?.id ? { ...row.author, id: userId(row.author.id) } : DELETED_AUTHOR;
  return {
    ...row,
    id: messageId(row.id),
    channelId: channelId(row.channelId),
    author,
  };
}

export const messageRoutes = new Elysia({ prefix: "/api/channels/:channelId/messages" })
  .resolve(authResolve({ allowBots: true }))

  // POST / — Create message
  .post("/", async ({ user: sessionUser, params, body, set }) => {
    await checkUserRateLimit(
      sessionUser.id,
      RL.MESSAGE_CREATE,
      RATE_LIMIT_MESSAGE_CREATE.limit,
      RATE_LIMIT_MESSAGE_CREATE.windowMs,
    );

    const resolution = await resolveChannel(params.channelId, sessionUser.id);

    const parsed = validateInput(createMessageSchema, body);

    if (!parsed.content) {
      throw new ValidationError("Message content is required");
    }

    const [inserted] = await db
      .insert(messages)
      .values({
        channelId: params.channelId,
        authorId: sessionUser.id,
        content: parsed.content,
      })
      .returning();

    if (!inserted) {
      throw new InternalError("Failed to create message");
    }

    const messageWithAuthor = await fetchMessageWithAuthor(inserted.id);

    const frame = { op: Opcode.MESSAGE_CREATE, d: messageWithAuthor } as const;
    if (resolution.type === "server") {
      broadcastToServer(resolution.serverId, frame);
    } else {
      await broadcastToDm(params.channelId, frame, sessionUser.id);
      // Also send to self so other tabs get the message
      sendToUser(sessionUser.id, frame);
    }

    set.status = 201;
    return messageWithAuthor;
  })

  // GET / — List messages with cursor pagination
  .get("/", async ({ user: sessionUser, params, query }) => {
    await resolveChannel(params.channelId, sessionUser.id);

    const { before, after, limit: rawLimit } = validateInput(listQuerySchema, query);
    const limit = rawLimit ?? DEFAULT_LIMIT;

    const conditions = [eq(messages.channelId, params.channelId)];

    // Cursor-based pagination
    if (before) {
      const [cursor] = await db
        .select({ createdAt: messages.createdAt, id: messages.id })
        .from(messages)
        .where(eq(messages.id, before))
        .limit(1);

      if (cursor) {
        const cursorCondition = or(
          lt(messages.createdAt, cursor.createdAt),
          and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
        );
        if (cursorCondition) conditions.push(cursorCondition);
      }
    } else if (after) {
      const [cursor] = await db
        .select({ createdAt: messages.createdAt, id: messages.id })
        .from(messages)
        .where(eq(messages.id, after))
        .limit(1);

      if (cursor) {
        const cursorCondition = or(
          gt(messages.createdAt, cursor.createdAt),
          and(eq(messages.createdAt, cursor.createdAt), gt(messages.id, cursor.id)),
        );
        if (cursorCondition) conditions.push(cursorCondition);
      }
    }

    const rows = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        content: messages.content,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        author: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isBot: user.isBot,
        },
        fileReceipt: {
          id: fileReceipts.id,
          senderId: fileReceipts.senderId,
          fileName: fileReceipts.fileName,
          fileSize: fileReceipts.fileSize,
          contentType: fileReceipts.contentType,
          magnetUri: fileReceipts.magnetUri,
          infoHash: fileReceipts.infoHash,
        },
      })
      .from(messages)
      .leftJoin(user, eq(user.id, messages.authorId))
      .leftJoin(fileReceipts, eq(fileReceipts.messageId, messages.id))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Reverse for oldest-first display order
    return {
      hasMore,
      messages: page.toReversed().map((row) => {
        const author = row.author?.id
          ? Object.assign(row.author, { id: userId(row.author.id) })
          : DELETED_AUTHOR;
        const receipt = row.fileReceipt?.id
          ? {
              id: row.fileReceipt.id,
              senderId: row.fileReceipt.senderId,
              fileName: row.fileReceipt.fileName,
              fileSize: row.fileReceipt.fileSize,
              contentType: row.fileReceipt.contentType,
              magnetUri: row.fileReceipt.magnetUri,
              infoHash: row.fileReceipt.infoHash,
            }
          : null;
        return Object.assign(row, {
          id: messageId(row.id),
          channelId: channelId(row.channelId),
          author,
          fileReceipt: receipt,
        });
      }),
    };
  })

  // PATCH /:messageId — Edit message
  .patch("/:messageId", async ({ user: sessionUser, params, body }) => {
    const resolution = await resolveChannel(params.channelId, sessionUser.id);

    const parsed = validateInput(updateMessageSchema, body);

    // Fetch message and verify ownership
    const [existing] = await db
      .select({ id: messages.id, channelId: messages.channelId, authorId: messages.authorId })
      .from(messages)
      .where(and(eq(messages.id, params.messageId), eq(messages.channelId, params.channelId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Message");
    }

    if (existing.authorId !== sessionUser.id) {
      throw new ForbiddenError("Only the author can edit this message");
    }

    const editedAt = new Date();
    await db
      .update(messages)
      .set({ content: parsed.content, editedAt })
      .where(eq(messages.id, params.messageId));

    const updated = await fetchMessageWithAuthor(params.messageId);

    const frame = {
      op: Opcode.MESSAGE_UPDATE,
      d: {
        id: messageId(params.messageId),
        channelId: channelId(params.channelId),
        content: parsed.content,
        editedAt,
      },
    } as const;

    if (resolution.type === "server") {
      broadcastToServer(resolution.serverId, frame);
    } else {
      await broadcastToDm(params.channelId, frame, sessionUser.id);
      sendToUser(sessionUser.id, frame);
    }

    return updated;
  })

  // DELETE /:messageId — Delete message
  .delete("/:messageId", async ({ user: sessionUser, params, set }) => {
    const resolution = await resolveChannel(params.channelId, sessionUser.id);

    // Fetch message
    const [existing] = await db
      .select({ id: messages.id, channelId: messages.channelId, authorId: messages.authorId })
      .from(messages)
      .where(and(eq(messages.id, params.messageId), eq(messages.channelId, params.channelId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Message");
    }

    // Author or server owner can delete
    if (existing.authorId !== sessionUser.id) {
      if (resolution.type === "dm") {
        throw new ForbiddenError("Cannot delete this message");
      }
      const [server] = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, resolution.serverId))
        .limit(1);

      if (!server || server.ownerId !== sessionUser.id) {
        throw new ForbiddenError("Cannot delete this message");
      }
    }

    await db.delete(messages).where(eq(messages.id, params.messageId));

    const frame = {
      op: Opcode.MESSAGE_DELETE,
      d: { id: messageId(params.messageId), channelId: channelId(params.channelId) },
    } as const;

    if (resolution.type === "server") {
      broadcastToServer(resolution.serverId, frame);
    } else {
      await broadcastToDm(params.channelId, frame, sessionUser.id);
      sendToUser(sessionUser.id, frame);
    }

    set.status = 204;
  });
