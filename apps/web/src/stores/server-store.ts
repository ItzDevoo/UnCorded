import {
  Opcode,
  serverId,
  userId,
  channelId,
  serverCreateEventSchema,
  serverDeleteEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { readyData, addServer, removeServer, setChannelsForServer } from "../lib/gateway-store.js";
import { selectedServerId, selectHome } from "./app-store.js";

// ── WS listener unsub refs ──────────────────────────────────────────────────

let unsubServerCreate: (() => void) | null = null;
let unsubServerDelete: (() => void) | null = null;

function teardown() {
  unsubServerCreate?.();
  unsubServerDelete?.();
  unsubServerCreate = null;
  unsubServerDelete = null;
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
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
