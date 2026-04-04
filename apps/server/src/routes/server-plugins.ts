import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError, RateLimitError } from "@uncorded/shared";
import { validateInput } from "../helpers/validation.js";
import { db } from "../db/index.js";
import { serverPlugins, pluginRegistry } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { computeEffectiveTier } from "../helpers/resolve-tier.js";
import { checkIpRateLimit } from "../middleware/ip-rate-limit.js";
import { getClientIp } from "../helpers/request.js";
import { RL } from "../helpers/rate-limit-keys.js";
import { broadcastToServer } from "../ws/connections.js";
import { Opcode } from "@uncorded/protocol";

// ── Schemas ────────────────────────────────────────────────────────────────────

const VALID_STATES = new Set(["active", "stopped", "error"]);

const installPluginSchema = z.object({
  pluginId: z.string().min(1, "pluginId is required"),
});

const updatePluginSchema = z
  .object({
    config: z.record(z.unknown()).optional(),
    state: z.string().optional(),
  })
  .refine((d) => d.config !== undefined || d.state !== undefined, {
    message: "No fields to update",
  });

const updateTunnelSchema = z.object({
  tunnelUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), { message: "tunnelUrl must use https://" })
    .nullable(),
  state: z.string().optional(),
});

function normalizeTunnelUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function safeJsonParse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function broadcastPluginState(
  serverId: string,
  pluginId: string,
  state: string,
  tunnelUrl: string | null,
): Promise<void> {
  const [reg] = await db
    .select({ name: pluginRegistry.name, iconUrl: pluginRegistry.iconUrl })
    .from(pluginRegistry)
    .where(eq(pluginRegistry.id, pluginId))
    .limit(1);

  broadcastToServer(serverId, {
    op: Opcode.SERVER_PLUGIN_STATE_UPDATE,
    d: {
      serverId,
      pluginId,
      state,
      tunnelUrl,
      name: reg?.name ?? pluginId,
      iconUrl: reg?.iconUrl ?? null,
    },
  });
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const serverPluginRoutes = new Elysia({ prefix: "/api/servers/:serverId/plugins" })
  .resolve(authResolve())

  // ── GET / — list installed server plugins (any member) ──────────────────
  .get("/", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

    const rows = await db
      .select({
        id: serverPlugins.id,
        pluginId: serverPlugins.pluginId,
        state: serverPlugins.state,
        tunnelUrl: serverPlugins.tunnelUrl,
        installedBy: serverPlugins.installedBy,
        installedAt: serverPlugins.installedAt,
        config: serverPlugins.config,
        name: pluginRegistry.name,
        iconUrl: pluginRegistry.iconUrl,
      })
      .from(serverPlugins)
      .leftJoin(pluginRegistry, eq(serverPlugins.pluginId, pluginRegistry.id))
      .where(eq(serverPlugins.serverId, params.serverId));

    return {
      plugins: rows.map((r) => ({
        id: r.id,
        pluginId: r.pluginId,
        state: r.state,
        tunnelUrl: r.tunnelUrl,
        installedBy: r.installedBy,
        installedAt: r.installedAt!.toISOString(),
        config: safeJsonParse(r.config),
        name: r.name ?? r.pluginId,
        iconUrl: r.iconUrl ?? null,
      })),
    };
  })

  // ── POST / — install server plugin (owner only, server_owner tier) ──────
  .post("/", async ({ user: sessionUser, params, body, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.SERVER_PLUGIN_INSTALL))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    await requireOwner(sessionUser.id, params.serverId);

    const tier = await computeEffectiveTier(sessionUser.id);
    if (tier !== "server_owner") {
      throw new ForbiddenError("Server Owner subscription required to install server plugins");
    }

    const { pluginId } = validateInput(installPluginSchema, body);

    // Validate plugin exists in registry
    const [registryPlugin] = await db
      .select({ id: pluginRegistry.id })
      .from(pluginRegistry)
      .where(and(eq(pluginRegistry.id, pluginId), eq(pluginRegistry.published, true)))
      .limit(1);
    if (!registryPlugin) throw new NotFoundError("Plugin");

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
          and(eq(serverPlugins.serverId, params.serverId), eq(serverPlugins.pluginId, pluginId)),
        );
      return { success: true, serverPlugin: existing };
    }

    return { success: true, serverPlugin: row };
  })

  // ── DELETE /:pluginId — uninstall server plugin (owner only) ────────────
  .delete("/:pluginId", async ({ user: sessionUser, params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.SERVER_PLUGIN_UNINSTALL))) {
      throw new RateLimitError("Too many requests, try again later");
    }

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
  .patch("/:pluginId", async ({ user: sessionUser, params, body, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.SERVER_PLUGIN_UPDATE))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    await requireOwner(sessionUser.id, params.serverId);

    const updates = validateInput(updatePluginSchema, body);
    const setValues: Record<string, unknown> = {};

    if (updates.config !== undefined) {
      setValues.config = JSON.stringify(updates.config);
    }
    if (updates.state !== undefined) {
      if (!VALID_STATES.has(updates.state)) {
        throw new ValidationError(`Invalid state: must be one of ${[...VALID_STATES].join(", ")}`);
      }
      setValues.state = updates.state;
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

    await broadcastPluginState(params.serverId, params.pluginId, updated.state, updated.tunnelUrl);

    return { success: true, serverPlugin: updated };
  })

  // ── GET /:pluginId/tunnel — get tunnel URL (any member) ────────────────
  .get("/:pluginId/tunnel", async ({ user: sessionUser, params, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 30, 60_000, RL.SERVER_PLUGIN_TUNNEL_READ))) {
      throw new RateLimitError("Too many requests, try again later");
    }

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

    return { tunnelUrl: normalizeTunnelUrl(row.tunnelUrl), state: row.state };
  })

  // ── PUT /:pluginId/tunnel — update tunnel URL (owner, called by sidecar)
  .put("/:pluginId/tunnel", async ({ user: sessionUser, params, body, request }) => {
    const ip = getClientIp(request);
    if (!(await checkIpRateLimit(ip, 10, 60_000, RL.SERVER_PLUGIN_UPDATE))) {
      throw new RateLimitError("Too many requests, try again later");
    }

    await requireOwner(sessionUser.id, params.serverId);

    const { tunnelUrl, state } = validateInput(updateTunnelSchema, body);

    const setValues: Record<string, unknown> = { tunnelUrl };
    if (state !== undefined) {
      if (!VALID_STATES.has(state)) {
        throw new ValidationError(`Invalid state: must be one of ${[...VALID_STATES].join(", ")}`);
      }
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

    await broadcastPluginState(params.serverId, params.pluginId, updated.state, updated.tunnelUrl);

    return { success: true, tunnelUrl: updated.tunnelUrl };
  });
