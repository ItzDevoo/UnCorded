import { z } from "zod";
import { Opcode, serverId, userId, channelId } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { readyData, addServer, removeServer } from "../lib/gateway-store.js";
import { selectedServerId, selectHome } from "./app-store.js";

// ── Zod schemas for WS events ──────────────────────────────────────────────

const serverCreateSchema = z.object({
  server: z.object({
    id: z.string(),
    name: z.string(),
    iconUrl: z.string().nullable(),
    ownerId: z.string(),
  }),
  channels: z.array(
    z.object({
      id: z.string(),
      serverId: z.string(),
      name: z.string(),
      type: z.string(),
      position: z.number(),
      topic: z.string().nullable(),
      fileSharingEnabled: z.boolean(),
    }),
  ),
});

const serverDeleteSchema = z.object({
  id: z.string(),
});

const memberAddSchema = z.object({
  serverId: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});

const memberRemoveSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
});

// ── WS listeners ────────────────────────────────────────────────────────────

const unsubServerCreate = onGatewayEvent(Opcode.SERVER_CREATE, (data) => {
  const parsed = serverCreateSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;

  // Dedup: skip if server already exists in readyData
  if (readyData.data?.servers.some((s) => s.id === d.server.id)) return;

  addServer({
    id: serverId(d.server.id),
    name: d.server.name,
    iconUrl: d.server.iconUrl,
    ownerId: userId(d.server.ownerId),
    channels: d.channels.map((ch) =>
      Object.assign(ch, { id: channelId(ch.id), serverId: serverId(ch.serverId) }),
    ),
  });
});

const unsubServerDelete = onGatewayEvent(Opcode.SERVER_DELETE, (data) => {
  const parsed = serverDeleteSchema.safeParse(data);
  if (!parsed.success) return;

  const deletedId = serverId(parsed.data.id);
  removeServer(deletedId);

  // Navigate away if the deleted server was selected
  if (selectedServerId() === deletedId) {
    selectHome();
  }
});

const unsubMemberAdd = onGatewayEvent(Opcode.MEMBER_ADD, (data) => {
  const parsed = memberAddSchema.safeParse(data);
  if (!parsed.success) return;
  // TODO: update member list panel when implemented
  void parsed.data;
});

const unsubMemberRemove = onGatewayEvent(Opcode.MEMBER_REMOVE, (data) => {
  const parsed = memberRemoveSchema.safeParse(data);
  if (!parsed.success) return;
  // TODO: update member list panel when implemented
  void parsed.data;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubServerCreate();
    unsubServerDelete();
    unsubMemberAdd();
    unsubMemberRemove();
  });
}
