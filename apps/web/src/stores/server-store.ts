import {
  Opcode,
  serverId,
  userId,
  channelId,
  serverCreateEventSchema,
  serverDeleteEventSchema,
  memberAddEventSchema,
  memberRemoveEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { readyData, addServer, removeServer } from "../lib/gateway-store.js";
import { selectedServerId, selectHome } from "./app-store.js";

// ── WS listeners ────────────────────────────────────────────────────────────

const unsubServerCreate = onGatewayEvent(Opcode.SERVER_CREATE, (data) => {
  const parsed = serverCreateEventSchema.safeParse(data);
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
  const parsed = serverDeleteEventSchema.safeParse(data);
  if (!parsed.success) return;

  const deletedId = serverId(parsed.data.id);
  removeServer(deletedId);

  // Navigate away if the deleted server was selected
  if (selectedServerId() === deletedId) {
    selectHome();
  }
});

const unsubMemberAdd = onGatewayEvent(Opcode.MEMBER_ADD, (data) => {
  const parsed = memberAddEventSchema.safeParse(data);
  if (!parsed.success) return;
  // TODO: update member list panel when implemented
  void parsed.data;
});

const unsubMemberRemove = onGatewayEvent(Opcode.MEMBER_REMOVE, (data) => {
  const parsed = memberRemoveEventSchema.safeParse(data);
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
