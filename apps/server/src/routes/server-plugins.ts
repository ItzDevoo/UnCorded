import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { serverPlugins } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { computeEffectiveTier } from "../helpers/resolve-tier.js";

// ── Routes ──────────────────────────────────────────────────────────────────

export const serverPluginRoutes = new Elysia({ prefix: "/api/servers/:serverId/plugins" })
  .resolve(authResolve())

  // ── GET / — list installed server plugins (any member) ──────────────────
  .get("/", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

    const rows = await db
      .select()
      .from(serverPlugins)
      .where(eq(serverPlugins.serverId, params.serverId));

    return {
      plugins: rows.map((r) => ({
        id: r.id,
        pluginId: r.pluginId,
        state: r.state,
        tunnelUrl: r.tunnelUrl,
        installedBy: r.installedBy,
        installedAt: r.installedAt.toISOString(),
        config: r.config ? JSON.parse(r.config) : {},
      })),
    };
  })

  // ── POST / — install server plugin (owner only, server_owner tier) ──────
  .post("/", async ({ user: sessionUser, params, body }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const tier = await computeEffectiveTier(sessionUser.id);
    if (tier !== "server_owner") {
      throw new ForbiddenError("Server Owner subscription required to install server plugins");
    }

    const { pluginId } = body as { pluginId: string };
    if (!pluginId || typeof pluginId !== "string") {
      throw new ForbiddenError("pluginId is required");
    }

    // Upsert — ignore if already installed
    const [row] = await db
      .insert(serverPlugins)
      .values({
        serverId: params.serverId,
        pluginId,
        installedBy: sessionUser.id,
      })
      .onConflictDoNothing({
        target: [serverPlugins.serverId, serverPlugins.pluginId],
      })
      .returning();

    // If conflict (already installed), fetch existing
    if (!row) {
      const [existing] = await db
        .select()
        .from(serverPlugins)
        .where(
          and(
            eq(serverPlugins.serverId, params.serverId),
            eq(serverPlugins.pluginId, pluginId),
          ),
        );
      return { success: true, serverPlugin: existing };
    }

    return { success: true, serverPlugin: row };
  })

  // ── DELETE /:pluginId — uninstall server plugin (owner only) ────────────
  .delete("/:pluginId", async ({ user: sessionUser, params }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const deleted = await db
      .delete(serverPlugins)
      .where(
        and(
          eq(serverPlugins.serverId, params.serverId),
          eq(serverPlugins.pluginId, params.pluginId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundError("Server plugin");
    }

    return { success: true };
  })

  // ── PATCH /:pluginId — update config/state (owner only) ────────────────
  .patch("/:pluginId", async ({ user: sessionUser, params, body }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const updates = body as { config?: Record<string, unknown>; state?: string };
    const setValues: Record<string, unknown> = {};

    if (updates.config !== undefined) {
      setValues.config = JSON.stringify(updates.config);
    }
    if (updates.state !== undefined) {
      setValues.state = updates.state;
    }

    if (Object.keys(setValues).length === 0) {
      throw new ForbiddenError("No fields to update");
    }

    const [updated] = await db
      .update(serverPlugins)
      .set(setValues)
      .where(
        and(
          eq(serverPlugins.serverId, params.serverId),
          eq(serverPlugins.pluginId, params.pluginId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundError("Server plugin");
    }

    return { success: true, serverPlugin: updated };
  })

  // ── GET /:pluginId/tunnel — get tunnel URL (any member) ────────────────
  .get("/:pluginId/tunnel", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

    const [row] = await db
      .select({ tunnelUrl: serverPlugins.tunnelUrl, state: serverPlugins.state })
      .from(serverPlugins)
      .where(
        and(
          eq(serverPlugins.serverId, params.serverId),
          eq(serverPlugins.pluginId, params.pluginId),
        ),
      );

    if (!row) {
      throw new NotFoundError("Server plugin");
    }

    return { tunnelUrl: row.tunnelUrl, state: row.state };
  })

  // ── PUT /:pluginId/tunnel — update tunnel URL (owner, called by sidecar)
  .put("/:pluginId/tunnel", async ({ user: sessionUser, params, body }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const { tunnelUrl, state } = body as { tunnelUrl: string | null; state?: string };

    const setValues: Record<string, unknown> = { tunnelUrl };
    if (state !== undefined) {
      setValues.state = state;
    }

    const [updated] = await db
      .update(serverPlugins)
      .set(setValues)
      .where(
        and(
          eq(serverPlugins.serverId, params.serverId),
          eq(serverPlugins.pluginId, params.pluginId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundError("Server plugin");
    }

    return { success: true, tunnelUrl: updated.tunnelUrl };
  });
