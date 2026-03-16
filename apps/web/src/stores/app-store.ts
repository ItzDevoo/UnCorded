import { createSignal, createMemo, createEffect, createRoot } from "solid-js";
import type { ServerId, ChannelId, DmChannelId } from "@uncorded/protocol";
import {
  readyData,
  channelCache,
  setChannelsForServer,
  setChannelCacheLoading,
  type ReadyServer,
  type ReadyChannel,
} from "../lib/gateway-store.js";
import { api } from "../lib/api.js";

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
    const id = selectedServerId();
    if (!id) return [];
    const cached = channelCache[id];
    return cached?.toSorted((a, b) => a.position - b.position) ?? [];
  });

  // Fetch channels lazily when a server is selected and not cached
  createEffect(() => {
    const id = selectedServerId();
    if (!id) return;
    if (channelCache[id]) return; // Already cached

    setChannelCacheLoading(id);
    api<ReadyChannel[]>(`/api/servers/${id}/channels`)
      .then((channels) => {
        setChannelsForServer(id, channels);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error("[app-store] Failed to fetch channels:", err);
      })
      .finally(() => {
        setChannelCacheLoading((prev) => (prev === id ? null : prev));
      });
  });

  // Auto-select first channel when channels change
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
