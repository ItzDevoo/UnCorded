import { createMemo, createEffect, Show, on } from "solid-js";
import type { AnyChannelId } from "@uncorded/protocol";
import { selectedChannelId, selectedDmChannelId, currentChannels } from "../stores/app-store.js";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import { shareFile } from "../stores/file-store.js";
import { showToast } from "./ui/toast.js";
import VirtualMessageList from "./VirtualMessageList.js";
import MessageInput from "./MessageInput.js";
import FileDropZone from "./FileDropZone.js";

const ChatArea = () => {
  const channelId = createMemo(
    () => selectedChannelId() ?? (selectedDmChannelId() as AnyChannelId | null),
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
      showToast(err instanceof Error ? err.message : "Failed to share file", "error");
    });
  }

  return (
    <div class="flex h-full flex-col">
      <Show when={channelId()}>
        {(id) => (
          <>
            <div class="flex h-12 shrink-0 items-center border-b border-border px-4">
              <span class="font-semibold text-foreground">
                {isDm() ? "@" : "# "}
                {channelName()}
              </span>
            </div>

            <FileDropZone channelId={id()} onFileSelect={handleFileSelect}>
              <VirtualMessageList channelId={id()} />
              <MessageInput channelId={id()} onFileSelect={handleFileSelect} />
            </FileDropZone>
          </>
        )}
      </Show>
      <Show when={!channelId()}>
        <div class="flex flex-1 items-center justify-center">
          <p class="text-muted-foreground">Select a channel to start chatting</p>
        </div>
      </Show>
    </div>
  );
};

export default ChatArea;
