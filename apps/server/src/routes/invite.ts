import { Elysia } from "elysia";
import { eq, and, or, gt, isNull, sql, count } from "drizzle-orm";
import { createInviteSchema } from "@uncorded/shared";
import { db } from "../db/index.js";
import { invites, servers, members } from "../db/schema.js";
import { getSession } from "../middleware/auth.js";
import { requireMember } from "../helpers/permissions.js";

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
    const member = await requireMember(sessionUser.id, params.serverId, set);
    if (!member) return { code: "FORBIDDEN", message: "Not a server member" };

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
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
    return invite;
  });

export const inviteCodeRoutes = new Elysia({ prefix: "/api/invites/:code" })
  .get("/", async ({ params, set }) => {
    const [invite] = await db.select().from(invites).where(eq(invites.code, params.code)).limit(1);

    if (!invite) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Invite not found" };
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
      set.status = 404;
      return { code: "NOT_FOUND", message: "Server not found" };
    }

    const [memberCount] = await db
      .select({ count: count() })
      .from(members)
      .where(eq(members.serverId, invite.serverId));

    return {
      code: invite.code,
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
  .post("/accept", async ({ user: sessionUser, params, set }) => {
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
      set.status = 404;
      return { code: "NOT_FOUND", message: "Invite not found or expired" };
    }

    const existingMember = await requireMember(sessionUser.id, invite.serverId, set);
    if (existingMember) {
      set.status = 409;
      return { code: "ALREADY_MEMBER", message: "Already a member of this server" };
    }

    // Reset status from requireMember's 403
    set.status = 200;

    await db.insert(members).values({
      userId: sessionUser.id,
      serverId: invite.serverId,
    });

    await db
      .update(invites)
      .set({ uses: sql`${invites.uses} + 1` })
      .where(eq(invites.code, params.code));

    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, invite.serverId))
      .limit(1);

    return { server };
  });

export const inviteRoutes = new Elysia().use(serverInviteRoutes).use(inviteCodeRoutes);
