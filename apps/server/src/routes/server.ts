import { Elysia } from "elysia";
import { eq, sql, and, count } from "drizzle-orm";
import {
  createServerSchema,
  updateServerSchema,
  transferOwnershipSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
  createId,
  MAX_SERVERS_PER_USER,
} from "@uncorded/shared";
import { serverId, userId } from "@uncorded/protocol";
import { brandServer, brandChannel } from "../helpers/brand.js";
import { db } from "../db/index.js";
import { servers, channels, members } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { addServerMember, removeServer } from "../ws/server-members.js";
import { broadcastToServer } from "../ws/connections.js";
import { Opcode } from "@uncorded/protocol";

export const serverRoutes = new Elysia({ prefix: "/api/servers" })
  .resolve(authResolve())
  .post("/", async ({ user: sessionUser, body, set }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot create servers");
    }

    const parsed = createServerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const newServerId = createId();
    const newChannelId = createId();

    const { server, channel } = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(servers)
        .where(eq(servers.ownerId, sessionUser.id));
      if ((row?.value ?? 0) >= MAX_SERVERS_PER_USER) {
        throw new ValidationError(`Maximum of ${MAX_SERVERS_PER_USER} servers reached`);
      }

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
      ...brandServer(server),
      channels: [channel ? brandChannel(channel) : channel],
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

    return userServers.map((s) => brandServer(s));
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

    return brandServer(server);
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

    if (updated) {
      broadcastToServer(params.serverId, {
        op: Opcode.SERVER_UPDATE,
        d: { id: serverId(updated.id), name: updated.name, iconUrl: updated.iconUrl },
      });
    }

    return updated ? brandServer(updated) : updated;
  })
  .patch("/:serverId/owner", async ({ user: sessionUser, params, body }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const parsed = transferOwnershipSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    if (parsed.data.newOwnerId === sessionUser.id) {
      throw new ValidationError("Cannot transfer ownership to yourself");
    }

    await requireMember(parsed.data.newOwnerId, params.serverId);

    const [updated] = await db
      .update(servers)
      .set({ ownerId: parsed.data.newOwnerId })
      .where(eq(servers.id, params.serverId))
      .returning();

    if (!updated) throw new NotFoundError("Server");

    broadcastToServer(params.serverId, {
      op: Opcode.SERVER_UPDATE,
      d: { id: serverId(params.serverId), ownerId: userId(updated.ownerId) },
    });

    return brandServer(updated);
  })
  .delete("/:serverId", async ({ user: sessionUser, params, set }) => {
    // Atomic ownership check + delete in one query to prevent TOCTOU race
    const deleted = await db
      .delete(servers)
      .where(and(eq(servers.id, params.serverId), eq(servers.ownerId, sessionUser.id)))
      .returning({ id: servers.id });

    if (deleted.length === 0) {
      await requireOwner(sessionUser.id, params.serverId); // throws ForbiddenError or NotFoundError
      return; // unreachable, but satisfies TypeScript
    }

    // Only broadcast + clean up in-memory state after successful DB delete
    broadcastToServer(params.serverId, {
      op: Opcode.SERVER_DELETE,
      d: { id: serverId(params.serverId) },
    });
    removeServer(params.serverId);

    set.status = 204;
  });
