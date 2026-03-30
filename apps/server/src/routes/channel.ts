import { Elysia } from "elysia";
import { eq, max, count } from "drizzle-orm";
import {
  createChannelSchema,
  updateChannelSchema,
  ValidationError,
  InternalError,
  MAX_CHANNELS_PER_SERVER,
} from "@uncorded/shared";
import { Opcode, channelId, serverId } from "@uncorded/protocol";
import { validateInput } from "../helpers/validation.js";
import { findOrThrow } from "../helpers/query.js";
import { brandChannel } from "../helpers/brand.js";
import { db } from "../db/index.js";
import { channels } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { requireMember, requireOwner } from "../helpers/permissions.js";
import { addChannelToCache, removeChannelFromCache } from "../ws/channel-cache.js";
import { broadcastToServer } from "../ws/connections.js";

const serverChannelRoutes = new Elysia({ prefix: "/api/servers/:serverId/channels" })
  .resolve(authResolve())
  .post("/", async ({ user: sessionUser, params, body, set }) => {
    await requireOwner(sessionUser.id, params.serverId);

    const parsed = validateInput(createChannelSchema, body);

    const channel = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(channels)
        .where(eq(channels.serverId, params.serverId));
      if ((row?.value ?? 0) >= MAX_CHANNELS_PER_SERVER) {
        throw new ValidationError(`Maximum of ${MAX_CHANNELS_PER_SERVER} channels reached`);
      }

      const [maxPos] = await tx
        .select({ maxPosition: max(channels.position) })
        .from(channels)
        .where(eq(channels.serverId, params.serverId));

      const nextPosition = (maxPos?.maxPosition ?? -1) + 1;

      const [ch] = await tx
        .insert(channels)
        .values({
          serverId: params.serverId,
          name: parsed.name,
          type: parsed.type ?? "text",
          fileSharingEnabled: parsed.fileSharingEnabled ?? true,
          topic: parsed.topic ?? null,
          position: nextPosition,
        })
        .returning();

      if (!ch) throw new InternalError("Failed to create channel");
      return ch;
    });

    addChannelToCache(channel.id, channel.serverId);

    const branded = brandChannel(channel);

    broadcastToServer(params.serverId, { op: Opcode.CHANNEL_CREATE, d: branded });

    set.status = 201;
    return branded;
  })
  .get("/", async ({ user: sessionUser, params }) => {
    await requireMember(sessionUser.id, params.serverId);

    const serverChannels = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, params.serverId))
      .orderBy(channels.position);

    return serverChannels.map((ch) => brandChannel(ch));
  });

const channelIdRoutes = new Elysia({ prefix: "/api/channels/:channelId" })
  .resolve(authResolve())
  .patch("/", async ({ user: sessionUser, params, body }) => {
    const channel = await findOrThrow(
      db
        .select({ id: channels.id, serverId: channels.serverId })
        .from(channels)
        .where(eq(channels.id, params.channelId))
        .limit(1),
      "Channel",
    );

    await requireOwner(sessionUser.id, channel.serverId);

    const parsed = validateInput(updateChannelSchema, body);

    const updates: Partial<typeof channels.$inferInsert> = {};

    if (parsed.name !== undefined) updates.name = parsed.name;
    if (parsed.topic !== undefined) updates.topic = parsed.topic ?? null;
    if (parsed.fileSharingEnabled !== undefined)
      updates.fileSharingEnabled = parsed.fileSharingEnabled;
    if (parsed.position !== undefined) updates.position = parsed.position;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No fields to update");
    }

    const updated = await db.transaction(async (tx) =>
      findOrThrow(
        tx
          .update(channels)
          .set(updates)
          .where(eq(channels.id, params.channelId))
          .returning(),
        "Channel",
      ),
    );

    const branded = brandChannel(updated);

    broadcastToServer(channel.serverId, { op: Opcode.CHANNEL_UPDATE, d: branded });

    return branded;
  })
  .delete("/", async ({ user: sessionUser, params, set }) => {
    const channel = await findOrThrow(
      db
        .select({ id: channels.id, serverId: channels.serverId })
        .from(channels)
        .where(eq(channels.id, params.channelId))
        .limit(1),
      "Channel",
    );

    await requireOwner(sessionUser.id, channel.serverId);

    await db.delete(channels).where(eq(channels.id, params.channelId));

    removeChannelFromCache(params.channelId);

    broadcastToServer(channel.serverId, {
      op: Opcode.CHANNEL_DELETE,
      d: { id: channelId(params.channelId), serverId: serverId(channel.serverId) },
    });

    set.status = 204;
  });

export const channelRoutes = new Elysia().use(serverChannelRoutes).use(channelIdRoutes);
