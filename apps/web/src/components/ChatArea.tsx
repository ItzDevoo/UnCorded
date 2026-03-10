import { createMemo, createEffect, Show, on } from "solid-js";
import type { ChannelId } from "@uncorded/protocol";
import { selectedChannelId, selectedDmChannelId, currentChannels } from "../stores/app-store.js";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import { shareFile } from "../stores/file-store.js";
import VirtualMessageList from "./VirtualMessageList.js";
import MessageInput from "./MessageInput.js";
import FileDropZone from "./FileDropZone.js";

const ChatArea = () => {
  const channelId = createMemo(
    () => selectedChannelId() ?? (selectedDmChannelId() as ChannelId | null),
  );

  const isDm = createMemo(() => !!selectedDmChannelId() && !selectedChannelId());

  const channelName = createMemo(() => {
    if (isDm()) {
      const dmId = selectedDmChannelId();
      const dm = readyData.data?.dmChannels.find((d) => d.id === dmId);
      return dm ? (dm.otherUser.displayName ?? dm.otherUser.username ?? "DM") : null;
    }
    const id = selectedChannelId();
    return currentChannels().find((c) => c.id === id)?.name ?? null;
  });

  // Fetch messages when channel changes
  createEffect(
    on(channelId, (id) => {
      if (id && !getMessages(id)) {
        fetchMessages(id);
      }
    }),
  );

  function handleFileSelect(file: File) {
    const id = channelId();
    if (!id) return;
    shareFile(id, file).catch((err) => {
      if (import.meta.env.DEV) console.error("[ChatArea] Failed to share file:", err);
    });
  }

  return (
    <div class="flex h-full flex-col">
      <Show when={channelName()}>
        {(name) => (
          <>
            <div class="flex h-12 shrink-0 items-center border-b border-border px-4">
              <span class="font-semibold text-foreground">
                {isDm() ? "@" : "# "}
                {name()}
              </span>
            </div>

            <FileDropZone channelId={channelId() as ChannelId} onFileSelect={handleFileSelect}>
              <VirtualMessageList channelId={channelId() as ChannelId} />
              <MessageInput channelId={channelId() as ChannelId} onFileSelect={handleFileSelect} />
            </FileDropZone>
          </>
        )}
      </Show>
      <Show when={!channelName()}>
        <div class="flex flex-1 items-center justify-center">
          <p class="text-muted-foreground">Select a channel to start chatting</p>
        </div>
      </Show>
    </div>
  );
};

export default ChatArea;
