import { createSignal, createMemo, createEffect, createRoot } from "solid-js";
import type { ServerId, ChannelId } from "@uncorded/protocol";
import { readyData, type ReadyServer, type ReadyChannel } from "../lib/gateway-store.js";

const [selectedServerId, setSelectedServerId] = createSignal<ServerId | null>(null);
const [selectedChannelId, setSelectedChannelId] = createSignal<ChannelId | null>(null);

// All reactive computations must be inside a root for proper SolidJS ownership
let currentServer: () => ReadyServer | null;
let currentChannels: () => ReadyChannel[];

const dispose = createRoot((d) => {
  currentServer = createMemo<ReadyServer | null>(() => {
    const id = selectedServerId();
    return readyData.data?.servers.find((s) => s.id === id) ?? null;
  });

  currentChannels = createMemo<ReadyChannel[]>(() => {
    const server = currentServer();
    return server?.channels.toSorted((a, b) => a.position - b.position) ?? [];
  });

  // Auto-select first server on READY if none selected
  createEffect(() => {
    const servers = readyData.data?.servers;
    if (servers && servers.length > 0 && !selectedServerId()) {
      const first = servers[0];
      if (first) setSelectedServerId(first.id);
    }
  });

  // Auto-select first channel when server changes
  createEffect(() => {
    const chs = currentChannels();
    if (chs.length > 0 && !chs.find((c) => c.id === selectedChannelId())) {
      const first = chs[0];
      if (first) setSelectedChannelId(first.id);
    }
  });

  return d;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => dispose());
}

export {
  selectedServerId,
  setSelectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  currentServer,
  currentChannels,
};
