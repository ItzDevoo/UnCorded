import { Elysia } from "elysia";
import { eq, and, lt, gt, desc, or } from "drizzle-orm";
import {
  createMessageSchema,
  updateMessageSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@uncorded/shared";
import { Opcode, messageId, channelId, userId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { messages, channels, servers, user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember } from "../helpers/permissions.js";
import { broadcastToServer } from "../ws/connections.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Look up channel and return its serverId, or throw NotFoundError. */
async function getChannelServerId(chanId: string): Promise<string> {
  const [channel] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, chanId))
    .limit(1);

  if (!channel) {
    throw new NotFoundError("Channel");
  }

  return channel.serverId;
}

/** Fetch a single message with author info. */
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
      },
    })
    .from(messages)
    .innerJoin(user, eq(user.id, messages.authorId))
    .where(eq(messages.id, msgId))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    id: messageId(row.id),
    channelId: channelId(row.channelId),
    author: { ...row.author, id: userId(row.author.id) },
  };
}

export const messageRoutes = new Elysia({ prefix: "/api/channels/:channelId/messages" })
  .resolve(async ({ status, request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      return status(401, { code: "UNAUTHORIZED", message: "Authentication required" });
    }
    return {
      user: session.user,
      session: session.session,
    };
  })

  // POST / — Create message
  .post("/", async ({ user: sessionUser, params, body, set }) => {
    const serverId = await getChannelServerId(params.channelId);
    await requireMember(sessionUser.id, serverId);

    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    if (!parsed.data.content || parsed.data.content.trim().length === 0) {
      throw new ValidationError("Message content is required");
    }

    const [inserted] = await db
      .insert(messages)
      .values({
        channelId: params.channelId,
        authorId: sessionUser.id,
        content: parsed.data.content,
      })
      .returning();

    if (!inserted) {
      set.status = 500;
      return { code: "INTERNAL_ERROR", message: "Failed to create message" };
    }

    const messageWithAuthor = await fetchMessageWithAuthor(inserted.id);

    await broadcastToServer(serverId, {
      op: Opcode.MESSAGE_CREATE,
      d: messageWithAuthor,
    });

    set.status = 201;
    return messageWithAuthor;
  })

  // GET / — List messages with cursor pagination
  .get("/", async ({ user: sessionUser, params, query }) => {
    const serverId = await getChannelServerId(params.channelId);
    await requireMember(sessionUser.id, serverId);

    const before = query.before as string | undefined;
    const after = query.after as string | undefined;
    const rawLimit = Number(query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

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
        },
      })
      .from(messages)
      .innerJoin(user, eq(user.id, messages.authorId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);

    // Reverse for oldest-first display order
    return {
      messages: rows.toReversed().map((row) =>
        Object.assign(row, {
          id: messageId(row.id),
          channelId: channelId(row.channelId),
          author: Object.assign(row.author, { id: userId(row.author.id) }),
        }),
      ),
    };
  })

  // PATCH /:messageId — Edit message
  .patch("/:messageId", async ({ user: sessionUser, params, body }) => {
    const serverId = await getChannelServerId(params.channelId);
    await requireMember(sessionUser.id, serverId);

    const parsed = updateMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

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
      .set({ content: parsed.data.content, editedAt })
      .where(eq(messages.id, params.messageId));

    const updated = await fetchMessageWithAuthor(params.messageId);

    await broadcastToServer(serverId, {
      op: Opcode.MESSAGE_UPDATE,
      d: {
        id: messageId(params.messageId),
        channelId: channelId(params.channelId),
        content: parsed.data.content,
        editedAt,
      },
    });

    return updated;
  })

  // DELETE /:messageId — Delete message
  .delete("/:messageId", async ({ user: sessionUser, params, set }) => {
    const serverId = await getChannelServerId(params.channelId);
    await requireMember(sessionUser.id, serverId);

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
      const [server] = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server || server.ownerId !== sessionUser.id) {
        throw new ForbiddenError("Cannot delete this message");
      }
    }

    await db.delete(messages).where(eq(messages.id, params.messageId));

    await broadcastToServer(serverId, {
      op: Opcode.MESSAGE_DELETE,
      d: { id: messageId(params.messageId), channelId: channelId(params.channelId) },
    });

    set.status = 204;
  });
