import { Elysia } from "elysia";
import { eq, sql, and } from "drizzle-orm";
import { createServerSchema, updateServerSchema } from "@uncorded/shared";
import { db } from "../db/index.js";
import { servers, channels, members } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";

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
      set.status = 400;
      return {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const [server] = await db
      .insert(servers)
      .values({
        name: parsed.data.name,
        iconUrl: parsed.data.iconUrl ?? null,
        ownerId: sessionUser.id,
      })
      .returning();

    if (!server) {
      set.status = 500;
      return { code: "INTERNAL_ERROR", message: "Failed to create server" };
    }

    const [channel] = await db
      .insert(channels)
      .values({
        serverId: server.id,
        name: "general",
        fileSharingEnabled: true,
        position: 0,
      })
      .returning();

    await db.insert(members).values({
      userId: sessionUser.id,
      serverId: server.id,
    });

    const result = { ...server, channels: [channel] };

    set.status = 201;
    return result;
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

    return userServers;
  })
  .get("/:serverId", async ({ user: sessionUser, params, set }) => {
    const member = await requireMember(sessionUser.id, params.serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, params.serverId))
      .limit(1);

    if (!server) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Server not found" };
    }

    return server;
  })
  .patch("/:serverId", async ({ user: sessionUser, params, body, set }) => {
    const server = await requireOwner(sessionUser.id, params.serverId, set);
    if (!server) return { code: "FORBIDDEN", message: "Not the server owner" };

    const parsed = updateServerSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const updates: Partial<typeof servers.$inferInsert> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.iconUrl !== undefined) updates.iconUrl = parsed.data.iconUrl ?? null;

    if (Object.keys(updates).length === 0) {
      set.status = 400;
      return { code: "NO_CHANGES", message: "No fields to update" };
    }

    const [updated] = await db
      .update(servers)
      .set(updates)
      .where(eq(servers.id, params.serverId))
      .returning();

    return updated;
  })
  .delete("/:serverId", async ({ user: sessionUser, params, set }) => {
    const server = await requireOwner(sessionUser.id, params.serverId, set);
    if (!server) return { code: "FORBIDDEN", message: "Not the server owner" };

    await db.delete(servers).where(eq(servers.id, params.serverId));

    set.status = 204;
  });
