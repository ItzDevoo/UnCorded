import { Elysia } from "elysia";
import { eq, sql, and } from "drizzle-orm";
import {
  createServerSchema,
  updateServerSchema,
  ValidationError,
  NotFoundError,
  InternalError,
  createId,
} from "@uncorded/shared";
import { serverId, userId, channelId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { servers, channels, members } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { addServerMember, removeServer } from "../ws/server-members.js";
import { broadcastToServer } from "../ws/connections.js";
import { Opcode } from "@uncorded/protocol";

export const serverRoutes = new Elysia({ prefix: "/api/servers" })
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
  .post("/", async ({ user: sessionUser, body, set }) => {
    const parsed = createServerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const newServerId = createId();
    const newChannelId = createId();

    const { server, channel } = await db.transaction(async (tx) => {
      const [srv] = await tx
        .insert(servers)
        .values({
          id: newServerId,
          name: parsed.data.name,
          iconUrl: parsed.data.iconUrl ?? null,
          ownerId: sessionUser.id,
        })
        .returning();

      if (!srv) {
        throw new InternalError("Failed to create server");
      }

      const [ch] = await tx
        .insert(channels)
        .values({
          id: newChannelId,
          serverId: newServerId,
          name: "general",
          fileSharingEnabled: true,
          position: 0,
        })
        .returning();

      await tx.insert(members).values({
        userId: sessionUser.id,
        serverId: newServerId,
      });

      return { server: srv, channel: ch };
    });

    addServerMember(server.id, sessionUser.id);

    set.status = 201;
    return {
      ...server,
      id: serverId(server.id),
      ownerId: userId(server.ownerId),
      channels: [
        channel
          ? { ...channel, id: channelId(channel.id), serverId: serverId(channel.serverId) }
          : channel,
      ],
    };
  })
  .get("/", async ({ user: sessionUser }) => {
    const channelCount = db
      .select({ count: sql<number>`count(*)::int` })
      .from(channels)
      .where(eq(channels.serverId, servers.id));

    const userServers = await db
      .select({
        id: servers.id,
        name: servers.name,
        iconUrl: servers.iconUrl,
        ownerId: servers.ownerId,
        createdAt: servers.createdAt,
        channelCount: sql<number>`(${channelCount})`,
      })
      .from(servers)
      .innerJoin(
        members,
        and(eq(members.serverId, servers.id), eq(members.userId, sessionUser.id)),
      );

    return userServers.map((s) =>
      Object.assign(s, { id: serverId(s.id), ownerId: userId(s.ownerId) }),
    );
  })
  .get("/:serverId", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, params.serverId))
      .limit(1);

    if (!server) {
      throw new NotFoundError("Server");
    }

    return { ...server, id: serverId(server.id), ownerId: userId(server.ownerId) };
  })
  .patch("/:serverId", async ({ user: sessionUser, params, body }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const parsed = updateServerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const updates: Partial<typeof servers.$inferInsert> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.iconUrl !== undefined) updates.iconUrl = parsed.data.iconUrl ?? null;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No fields to update");
    }

    const [updated] = await db
      .update(servers)
      .set(updates)
      .where(eq(servers.id, params.serverId))
      .returning();

    return updated
      ? { ...updated, id: serverId(updated.id), ownerId: userId(updated.ownerId) }
      : updated;
  })
  .delete("/:serverId", async ({ user: sessionUser, params, set }) => {
    await requireOwner(sessionUser.id, params.serverId);

    // Broadcast before registry cleanup (broadcastToServer reads the member set)
    broadcastToServer(params.serverId, {
      op: Opcode.SERVER_DELETE,
      d: { id: serverId(params.serverId) },
    });

    // Remove from registry to prevent new joins, then commit DB delete
    removeServer(params.serverId);
    await db.delete(servers).where(eq(servers.id, params.serverId));

    set.status = 204;
  });
