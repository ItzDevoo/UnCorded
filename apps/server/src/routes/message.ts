import { Elysia } from "elysia";
import { eq, and, lt, gt, desc, or, ne } from "drizzle-orm";
import { z } from "zod";
import {
  createMessageSchema,
  updateMessageSchema,
  MESSAGE_PAGE_LIMIT,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from "@uncorded/shared";
import { Opcode, messageId, channelId, userId } from "@uncorded/protocol";
import type { GatewayFrame } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { messages, channels, servers, user, dmMembers } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember } from "../helpers/permissions.js";
import { broadcastToServer, sendToUser } from "../ws/connections.js";

const DEFAULT_LIMIT = MESSAGE_PAGE_LIMIT;
const MAX_LIMIT = 100;

const listQuerySchema = z.object({
  before: z.string().min(1).optional(),
  after: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

type ChannelResolution = { type: "server"; serverId: string } | { type: "dm" };

/** Resolve a channel ID to either a server channel or DM channel. */
async function resolveChannel(chanId: string, reqUserId: string): Promise<ChannelResolution> {
  // Try server channel first
  const [serverCh] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, chanId))
    .limit(1);

  if (serverCh) {
    await requireMember(reqUserId, serverCh.serverId);
    return { type: "server", serverId: serverCh.serverId };
  }

  // Try DM channel
  const [dmMem] = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(and(eq(dmMembers.channelId, chanId), eq(dmMembers.userId, reqUserId)))
    .limit(1);

  if (dmMem) return { type: "dm" };

  throw new NotFoundError("Channel");
}

/** Broadcast a frame to all DM members except the sender. */
async function broadcastToDm(chanId: string, frame: GatewayFrame, excludeUserId: string) {
  const others = await db
    .select({ userId: dmMembers.userId })
    .from(dmMembers)
    .where(and(eq(dmMembers.channelId, chanId), ne(dmMembers.userId, excludeUserId)));
  for (const m of others) sendToUser(m.userId, frame);
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
    const resolution = await resolveChannel(params.channelId, sessionUser.id);

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
      throw new InternalError("Failed to create message");
    }

    const messageWithAuthor = await fetchMessageWithAuthor(inserted.id);

    const frame = { op: Opcode.MESSAGE_CREATE, d: messageWithAuthor } as const;
    if (resolution.type === "server") {
      await broadcastToServer(resolution.serverId, frame);
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

    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new ValidationError("Invalid query parameters");
    const { before, after, limit: rawLimit } = parsed.data;
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
    const resolution = await resolveChannel(params.channelId, sessionUser.id);

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

    const frame = {
      op: Opcode.MESSAGE_UPDATE,
      d: {
        id: messageId(params.messageId),
        channelId: channelId(params.channelId),
        content: parsed.data.content,
        editedAt,
      },
    } as const;

    if (resolution.type === "server") {
      await broadcastToServer(resolution.serverId, frame);
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
      await broadcastToServer(resolution.serverId, frame);
    } else {
      await broadcastToDm(params.channelId, frame, sessionUser.id);
      sendToUser(sessionUser.id, frame);
    }

    set.status = 204;
  });
