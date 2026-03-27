import { Elysia } from "elysia";
import { eq, and, or, gt, isNull, sql, count } from "drizzle-orm";
import {
  createInviteSchema,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  MAX_INVITES_PER_SERVER,
} from "@uncorded/shared";
import { Opcode, inviteCode, serverId, userId, channelId } from "@uncorded/protocol";
import { NeonDbError } from "@neondatabase/serverless";
import { db } from "../db/index.js";
import { invites, servers, members, channels, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { addServerMember } from "../ws/server-members.js";
import { sendToUser, broadcastToServer } from "../ws/connections.js";

export const serverInviteRoutes = new Elysia({ prefix: "/api/servers/:serverId/invites" })
  .resolve(authResolve())
  .post("/", async ({ user: sessionUser, params, body, set }) => {
    await requireMember(sessionUser.id, params.serverId);

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const [invite] = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(invites)
        .where(eq(invites.serverId, params.serverId));
      if ((row?.value ?? 0) >= MAX_INVITES_PER_SERVER) {
        throw new ValidationError(`Maximum of ${MAX_INVITES_PER_SERVER} invites reached`);
      }

      return tx
        .insert(invites)
        .values({
          serverId: params.serverId,
          creatorId: sessionUser.id,
          maxUses: parsed.data.maxUses ?? null,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        })
        .returning();
    });

    set.status = 201;
    return invite
      ? {
          ...invite,
          code: inviteCode(invite.code),
          serverId: serverId(invite.serverId),
          creatorId: invite.creatorId ? userId(invite.creatorId) : null,
        }
      : invite;
  })
  .get("/", async ({ user: sessionUser, params }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const activeInvites = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.serverId, params.serverId),
          or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
          or(isNull(invites.maxUses), gt(invites.maxUses, invites.uses)),
        ),
      )
      .limit(100);

    return activeInvites.map((inv) =>
      Object.assign(inv, {
        code: inviteCode(inv.code),
        serverId: serverId(inv.serverId),
        creatorId: inv.creatorId ? userId(inv.creatorId) : null,
      }),
    );
  })
  .delete("/:code", async ({ user: sessionUser, params, set }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const [deleted] = await db
      .delete(invites)
      .where(and(eq(invites.code, params.code), eq(invites.serverId, params.serverId)))
      .returning();

    if (!deleted) throw new NotFoundError("Invite");

    set.status = 204;
  });

export const inviteCodeRoutes = new Elysia({ prefix: "/api/invites/:code" })
  .onBeforeHandle({ as: "local" }, async ({ request }) => {
    if (request.method !== "GET") return;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    if (!(await checkIpRateLimit(ip, 10, 60_000))) {
      throw new RateLimitError("Too many requests, try again later");
    }
  })
  .get("/", async ({ params }) => {
    const [invite] = await db.select().from(invites).where(eq(invites.code, params.code)).limit(1);

    if (!invite) {
      throw new NotFoundError("Invite");
    }

    const [server] = await db
      .select({
        name: servers.name,
        iconUrl: servers.iconUrl,
      })
      .from(servers)
      .where(eq(servers.id, invite.serverId))
      .limit(1);

    if (!server) {
      throw new NotFoundError("Server");
    }

    const [memberCount] = await db
      .select({ count: count() })
      .from(members)
      .where(eq(members.serverId, invite.serverId));

    return {
      code: inviteCode(invite.code),
      server: {
        name: server.name,
        iconUrl: server.iconUrl,
      },
      memberCount: memberCount?.count ?? 0,
    };
  })
  .resolve(authResolve({ allowBots: true }))
  .post("/accept", async ({ user: sessionUser, params }) => {
    const { invite, server, joinerProfile, serverChannels } = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.code, params.code),
            or(isNull(invites.maxUses), gt(invites.maxUses, invites.uses)),
            or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
          ),
        )
        .limit(1);

      if (!inv) {
        throw new NotFoundError("Invite");
      }

      const [srv] = await tx
        .select()
        .from(servers)
        .where(eq(servers.id, inv.serverId))
        .limit(1)
        .for("update");

      if (!srv) {
        throw new NotFoundError("Server");
      }

      try {
        await tx.insert(members).values({
          userId: sessionUser.id,
          serverId: inv.serverId,
        });
      } catch (err) {
        if (err instanceof NeonDbError && err.code === "23505") {
          throw new ConflictError("ALREADY_MEMBER", "Already a member of this server");
        }
        throw err;
      }

      await tx
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(eq(invites.code, params.code));

      const [joiner] = await tx
        .select({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isBot: user.isBot,
        })
        .from(user)
        .where(eq(user.id, sessionUser.id))
        .limit(1);

      const chans = await tx
        .select({
          id: channels.id,
          serverId: channels.serverId,
          name: channels.name,
          type: channels.type,
          position: channels.position,
          topic: channels.topic,
          fileSharingEnabled: channels.fileSharingEnabled,
        })
        .from(channels)
        .where(eq(channels.serverId, inv.serverId));

      return { invite: inv, server: srv, joinerProfile: joiner, serverChannels: chans };
    });

    addServerMember(invite.serverId, sessionUser.id);

    /* oxlint-disable no-map-spread -- copy-on-write required, DB rows must not be mutated */
    const serverPayload = {
      server: { ...server, id: serverId(server.id), ownerId: userId(server.ownerId) },
      channels: serverChannels
        .toSorted((a, b) => a.position - b.position)
        .map((ch) => ({ ...ch, id: channelId(ch.id), serverId: serverId(ch.serverId) })),
    };
    /* oxlint-enable no-map-spread */

    // Send SERVER_CREATE to the joining user so their client adds the server
    sendToUser(sessionUser.id, {
      op: Opcode.SERVER_CREATE,
      d: serverPayload,
    });

    // Broadcast MEMBER_ADD to existing members (exclude joiner)
    if (joinerProfile) {
      broadcastToServer(
        invite.serverId,
        {
          op: Opcode.MEMBER_ADD,
          d: {
            serverId: serverId(invite.serverId),
            user: { ...joinerProfile, id: userId(joinerProfile.id) },
          },
        },
        sessionUser.id,
      );
    }

    return serverPayload;
  });

export const inviteRoutes = new Elysia().use(serverInviteRoutes).use(inviteCodeRoutes);
