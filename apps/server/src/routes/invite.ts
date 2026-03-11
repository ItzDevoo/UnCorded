import { Elysia } from "elysia";
import { eq, and, or, gt, isNull, sql, count } from "drizzle-orm";
import {
  createInviteSchema,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@uncorded/shared";
import { Opcode, inviteCode, serverId, userId, channelId } from "@uncorded/protocol";
import { db } from "../db/index.js";
import { invites, servers, members, channels, user } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember, isMember } from "../helpers/permissions.js";
import { addServerMember } from "../ws/server-members.js";
import { sendToUser, broadcastToServer } from "../ws/connections.js";

export const serverInviteRoutes = new Elysia({ prefix: "/api/servers/:serverId/invites" })
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
  .post("/", async ({ user: sessionUser, params, body, set }) => {
    await requireMember(sessionUser.id, params.serverId);

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const [invite] = await db
      .insert(invites)
      .values({
        serverId: params.serverId,
        creatorId: sessionUser.id,
        maxUses: parsed.data.maxUses ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning();

    set.status = 201;
    return invite
      ? {
          ...invite,
          code: inviteCode(invite.code),
          serverId: serverId(invite.serverId),
          creatorId: invite.creatorId ? userId(invite.creatorId) : null,
        }
      : invite;
  });

export const inviteCodeRoutes = new Elysia({ prefix: "/api/invites/:code" })
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
  .post("/accept", async ({ user: sessionUser, params }) => {
    const [invite] = await db
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

    if (!invite) {
      throw new NotFoundError("Invite not found or expired");
    }

    const alreadyMember = await isMember(sessionUser.id, invite.serverId);
    if (alreadyMember) {
      throw new ConflictError("ALREADY_MEMBER", "Already a member of this server");
    }

    await db.insert(members).values({
      userId: sessionUser.id,
      serverId: invite.serverId,
    });

    addServerMember(invite.serverId, sessionUser.id);

    await db
      .update(invites)
      .set({ uses: sql`${invites.uses} + 1` })
      .where(eq(invites.code, params.code));

    // Query joining user's profile for MEMBER_ADD broadcast
    const [joinerProfile] = await db
      .select({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, invite.serverId))
      .limit(1);

    const serverChannels = await db
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
      .where(eq(channels.serverId, invite.serverId));

    /* oxlint-disable no-map-spread -- copy-on-write required, DB rows must not be mutated */
    const serverPayload = {
      server: server
        ? { ...server, id: serverId(server.id), ownerId: userId(server.ownerId) }
        : server,
      channels: serverChannels
        .toSorted((a, b) => a.position - b.position)
        .map((ch) => ({ ...ch, id: channelId(ch.id), serverId: serverId(ch.serverId) })),
    };

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
    /* oxlint-enable no-map-spread */
  });

export const inviteRoutes = new Elysia().use(serverInviteRoutes).use(inviteCodeRoutes);
