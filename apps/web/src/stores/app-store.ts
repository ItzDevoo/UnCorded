import { createSignal, createMemo, createEffect } from "solid-js";
import { readyData, type ReadyServer, type ReadyChannel } from "../lib/gateway-store.js";

const [selectedServerId, setSelectedServerId] = createSignal<string | null>(null);
const [selectedChannelId, setSelectedChannelId] = createSignal<string | null>(null);

const currentServer = createMemo<ReadyServer | null>(() => {
  const id = selectedServerId();
  return readyData.data?.servers.find((s) => s.id === id) ?? null;
});

const currentChannels = createMemo<ReadyChannel[]>(() => {
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

export {
  selectedServerId,
  setSelectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  currentServer,
  currentChannels,
};
