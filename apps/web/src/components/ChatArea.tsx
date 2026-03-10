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

  const dmChannel = createMemo(() => {
    if (!isDm()) return null;
    const dmId = selectedDmChannelId();
    return readyData.data?.dmChannels.find((d) => d.id === dmId) ?? null;
  });

  const channelName = createMemo(() => {
    if (isDm()) {
      const dm = dmChannel();
      return dm ? (dm.otherUser.displayName ?? dm.otherUser.username ?? "DM") : null;
    }
    const id = selectedChannelId();
    return currentChannels().find((c) => c.id === id)?.name ?? null;
  });

  const channelTopic = createMemo(() => {
    if (isDm()) return null;
    const id = selectedChannelId();
    return currentChannels().find((c) => c.id === id)?.topic ?? null;
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
            <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
              <Show
                when={isDm()}
                fallback={
                  <>
                    <span class="text-lg text-muted-foreground">#</span>
                    <span class="font-semibold text-foreground">{channelName()}</span>
                    <Show when={channelTopic()}>
                      {(topic) => (
                        <>
                          <div class="h-4 w-px bg-border" />
                          <span class="truncate text-sm text-muted-foreground">{topic()}</span>
                        </>
                      )}
                    </Show>
                  </>
                }
              >
                <Show when={dmChannel()}>
                  {(dm) => (
                    <>
                      <Show
                        when={dm().otherUser.avatarUrl}
                        fallback={
                          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            {(dm().otherUser.displayName ?? dm().otherUser.username ?? "?")[0]?.toUpperCase()}
                          </div>
                        }
                      >
                        {(url) => (
                          <img src={url()} alt="" class="h-7 w-7 shrink-0 rounded-full object-cover" />
                        )}
                      </Show>
                      <span class="font-semibold text-foreground">{channelName()}</span>
                      <div
                        class={`h-2 w-2 rounded-full ${dm().otherUser.status === "online" ? "bg-success" : "bg-muted-foreground/50"}`}
                        title={dm().otherUser.status}
                      />
                    </>
                  )}
                </Show>
              </Show>
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
