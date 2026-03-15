import {
  Opcode,
  serverId,
  userId,
  channelId,
  serverCreateEventSchema,
  serverDeleteEventSchema,
  serverUpdateEventSchema,
  channelCreateEventSchema,
  channelUpdateEventSchema,
  channelDeleteEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import {
  readyData,
  addServer,
  updateServer,
  removeServer,
  setChannelsForServer,
  addChannel,
  removeChannel,
  updateChannel,
} from "../lib/gateway-store.js";
import { selectedServerId, selectHome } from "./app-store.js";

// ── WS listener unsub refs ──────────────────────────────────────────────────

let unsubServerCreate: (() => void) | null = null;
let unsubServerDelete: (() => void) | null = null;
let unsubServerUpdate: (() => void) | null = null;
let unsubChannelCreate: (() => void) | null = null;
let unsubChannelUpdate: (() => void) | null = null;
let unsubChannelDelete: (() => void) | null = null;

function teardown() {
  unsubServerCreate?.();
  unsubServerDelete?.();
  unsubServerUpdate?.();
  unsubChannelCreate?.();
  unsubChannelUpdate?.();
  unsubChannelDelete?.();
  unsubServerCreate = null;
  unsubServerDelete = null;
  unsubServerUpdate = null;
  unsubChannelCreate = null;
  unsubChannelUpdate = null;
  unsubChannelDelete = null;
}

export function setupServerStore(): void {
  // Guard against double-init (HMR or reconnect)
  teardown();

  unsubServerCreate = onGatewayEvent(Opcode.SERVER_CREATE, (data) => {
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
    });

    setChannelsForServer(
      serverId(d.server.id),
      d.channels.map((ch) =>
        Object.assign(ch, { id: channelId(ch.id), serverId: serverId(ch.serverId) }),
      ),
    );
  });

  unsubServerDelete = onGatewayEvent(Opcode.SERVER_DELETE, (data) => {
    const parsed = serverDeleteEventSchema.safeParse(data);
    if (!parsed.success) return;

    const deletedId = serverId(parsed.data.id);
    removeServer(deletedId);

    // Navigate away if the deleted server was selected
    if (selectedServerId() === deletedId) {
      selectHome();
    }
  });

  unsubServerUpdate = onGatewayEvent(Opcode.SERVER_UPDATE, (data) => {
    const parsed = serverUpdateEventSchema.safeParse(data);
    if (!parsed.success) return;

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.iconUrl !== undefined) updates.iconUrl = parsed.data.iconUrl;
    if (parsed.data.ownerId !== undefined) updates.ownerId = userId(parsed.data.ownerId);

    updateServer(serverId(parsed.data.id), updates);
  });

  unsubChannelCreate = onGatewayEvent(Opcode.CHANNEL_CREATE, (data) => {
    const parsed = channelCreateEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    addChannel(serverId(d.serverId), {
      id: channelId(d.id),
      serverId: serverId(d.serverId),
      name: d.name,
      type: d.type,
      position: d.position,
      topic: d.topic,
      fileSharingEnabled: d.fileSharingEnabled,
    });
  });

  unsubChannelUpdate = onGatewayEvent(Opcode.CHANNEL_UPDATE, (data) => {
    const parsed = channelUpdateEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    const sId = serverId(d.serverId);
    const chId = channelId(d.id);
    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.topic !== undefined) updates.topic = d.topic;
    if (d.position !== undefined) updates.position = d.position;
    if (d.fileSharingEnabled !== undefined) updates.fileSharingEnabled = d.fileSharingEnabled;
    updateChannel(sId, chId, updates);
  });

  unsubChannelDelete = onGatewayEvent(Opcode.CHANNEL_DELETE, (data) => {
    const parsed = channelDeleteEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    removeChannel(serverId(d.serverId), channelId(d.id));
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
