import { Elysia } from "elysia";
import { eq, and, lt, gt, desc, or } from "drizzle-orm";
import { createMessageSchema, updateMessageSchema } from "@uncorded/shared";
import { Opcode } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { messages, channels, servers, user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember } from "../helpers/permissions.js";
import { broadcastToServer } from "../ws/connections.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Look up channel and return its serverId, or null if not found (sets 404). */
async function getChannelServerId(channelId: string, set: { status?: number | string }) {
  const [channel] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    set.status = 404;
    return null;
  }

  return channel.serverId;
}

/** Fetch a single message with author info. */
async function fetchMessageWithAuthor(messageId: string) {
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
    .where(eq(messages.id, messageId))
    .limit(1);

  return row ?? null;
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
    const serverId = await getChannelServerId(params.channelId, set);
    if (!serverId) return { code: "NOT_FOUND", message: "Channel not found" };

    const member = await requireMember(sessionUser.id, serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    if (!parsed.data.content || parsed.data.content.trim().length === 0) {
      set.status = 400;
      return { code: "VALIDATION_ERROR", message: "Message content is required" };
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
  .get("/", async ({ user: sessionUser, params, query, set }) => {
    const serverId = await getChannelServerId(params.channelId, set);
    if (!serverId) return { code: "NOT_FOUND", message: "Channel not found" };

    const member = await requireMember(sessionUser.id, serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

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
    return { messages: rows.toReversed() };
  })

  // PATCH /:messageId — Edit message
  .patch("/:messageId", async ({ user: sessionUser, params, body, set }) => {
    const serverId = await getChannelServerId(params.channelId, set);
    if (!serverId) return { code: "NOT_FOUND", message: "Channel not found" };

    const member = await requireMember(sessionUser.id, serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

    const parsed = updateMessageSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    // Fetch message and verify ownership
    const [existing] = await db
      .select({ id: messages.id, channelId: messages.channelId, authorId: messages.authorId })
      .from(messages)
      .where(and(eq(messages.id, params.messageId), eq(messages.channelId, params.channelId)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Message not found" };
    }

    if (existing.authorId !== sessionUser.id) {
      set.status = 403;
      return { code: "FORBIDDEN", message: "Only the author can edit this message" };
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
        id: params.messageId,
        channelId: params.channelId,
        content: parsed.data.content,
        editedAt,
      },
    });

    return updated;
  })

  // DELETE /:messageId — Delete message
  .delete("/:messageId", async ({ user: sessionUser, params, set }) => {
    const serverId = await getChannelServerId(params.channelId, set);
    if (!serverId) return { code: "NOT_FOUND", message: "Channel not found" };

    const member = await requireMember(sessionUser.id, serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

    // Fetch message
    const [existing] = await db
      .select({ id: messages.id, channelId: messages.channelId, authorId: messages.authorId })
      .from(messages)
      .where(and(eq(messages.id, params.messageId), eq(messages.channelId, params.channelId)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Message not found" };
    }

    // Author or server owner can delete
    if (existing.authorId !== sessionUser.id) {
      const [server] = await db
        .select({ ownerId: servers.ownerId })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server || server.ownerId !== sessionUser.id) {
        set.status = 403;
        return { code: "FORBIDDEN", message: "Cannot delete this message" };
      }
    }

    await db.delete(messages).where(eq(messages.id, params.messageId));

    await broadcastToServer(serverId, {
      op: Opcode.MESSAGE_DELETE,
      d: { id: params.messageId, channelId: params.channelId },
    });

    set.status = 204;
  });
