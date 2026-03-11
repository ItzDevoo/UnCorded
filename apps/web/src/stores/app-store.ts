import { createSignal, createMemo, createEffect, createRoot } from "solid-js";
import type { ServerId, ChannelId, DmChannelId } from "@uncorded/protocol";
import { readyData, type ReadyServer, type ReadyChannel } from "../lib/gateway-store.js";

const [selectedServerId, setSelectedServerId] = createSignal<ServerId | null>(null);
const [selectedChannelId, setSelectedChannelId] = createSignal<ChannelId | null>(null);
const [selectedDmChannelId, setSelectedDmChannelId] = createSignal<DmChannelId | null>(null);

function selectDmChannel(id: DmChannelId) {
  setSelectedServerId(null);
  setSelectedChannelId(null);
  setSelectedDmChannelId(id);
}

function selectHome() {
  setSelectedServerId(null);
  setSelectedChannelId(null);
  setSelectedDmChannelId(null);
}

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
  selectedDmChannelId,
  setSelectedDmChannelId,
  selectDmChannel,
  selectHome,
  currentServer,
  currentChannels,
};
