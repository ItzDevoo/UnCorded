import { createMemo, createEffect, Show, on } from "solid-js";
import type { AnyChannelId } from "@uncorded/protocol";
import { selectedChannelId, selectedDmChannelId, currentChannels } from "../stores/app-store.js";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import { shareFile } from "../stores/file-store.js";
import { showToast } from "./ui/toast.js";
import { Empty } from "./ui/empty.js";
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
                            {(dm().otherUser.displayName ??
                              dm().otherUser.username ??
                              "?")[0]?.toUpperCase()}
                          </div>
                        }
                      >
                        {(url) => (
                          <img
                            src={url()}
                            alt={channelName() ?? "User avatar"}
                            class="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
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
        <Empty
          title="No channel selected"
          description="Select a channel to start chatting"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
          }
          class="flex-1"
        />
      </Show>
    </div>
  );
};

export default ChatArea;
