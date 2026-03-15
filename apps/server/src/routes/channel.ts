import { Elysia } from "elysia";
import { eq, max, count } from "drizzle-orm";
import {
  createChannelSchema,
  updateChannelSchema,
  ValidationError,
  NotFoundError,
  InternalError,
  MAX_CHANNELS_PER_SERVER,
} from "@uncorded/shared";
import { Opcode, channelId, serverId } from "@uncorded/protocol";
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

    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

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
          name: parsed.data.name,
          type: parsed.data.type ?? "text",
          fileSharingEnabled: parsed.data.fileSharingEnabled ?? true,
          topic: parsed.data.topic ?? null,
          position: nextPosition,
        })
        .returning();

      if (!ch) throw new InternalError("Failed to create channel");
      return ch;
    });

    addChannelToCache(channel.id, channel.serverId);

    const branded = { ...channel, id: channelId(channel.id), serverId: serverId(channel.serverId) };

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

    return serverChannels.map((ch) =>
      Object.assign(ch, { id: channelId(ch.id), serverId: serverId(ch.serverId) }),
    );
  });

const channelIdRoutes = new Elysia({ prefix: "/api/channels/:channelId" })
  .resolve(authResolve())
  .patch("/", async ({ user: sessionUser, params, body }) => {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, params.channelId))
      .limit(1);

    if (!channel) {
      throw new NotFoundError("Channel");
    }

    await requireOwner(sessionUser.id, channel.serverId);

    const parsed = updateChannelSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const updates: Partial<typeof channels.$inferInsert> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.topic !== undefined) updates.topic = parsed.data.topic ?? null;
    if (parsed.data.fileSharingEnabled !== undefined)
      updates.fileSharingEnabled = parsed.data.fileSharingEnabled;
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No fields to update");
    }

    const [updated] = await db
      .update(channels)
      .set(updates)
      .where(eq(channels.id, params.channelId))
      .returning();

    if (!updated) throw new InternalError("Failed to update channel");

    const branded = { ...updated, id: channelId(updated.id), serverId: serverId(updated.serverId) };

    broadcastToServer(channel.serverId, { op: Opcode.CHANNEL_UPDATE, d: branded });

    return branded;
  })
  .delete("/", async ({ user: sessionUser, params, set }) => {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, params.channelId))
      .limit(1);

    if (!channel) {
      throw new NotFoundError("Channel");
    }

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
