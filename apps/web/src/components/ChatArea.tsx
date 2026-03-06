import { createMemo, createEffect, Show, For, on } from 'solid-js';
import { selectedChannelId, currentChannels } from '../stores/app-store.js';
import { readyData } from '../lib/gateway-store.js';
import { fetchMessages, getMessages } from '../stores/message-store.js';
import MessageBubble from './MessageBubble.js';
import MessageInput from './MessageInput.js';

const ChatArea = () => {
  let scrollRef!: HTMLDivElement;
  let isAtBottom = true;

  const channelName = createMemo(() => {
    const id = selectedChannelId();
    return currentChannels().find((c) => c.id === id)?.name ?? null;
  });

  const channelId = createMemo(() => selectedChannelId());

  const channelData = createMemo(() => {
    const id = channelId();
    return id ? getMessages(id) : undefined;
  });

  const messages = createMemo(() => channelData()?.messages ?? []);
  const loading = createMemo(() => channelData()?.loading ?? false);
  const hasMore = createMemo(() => channelData()?.hasMore ?? false);

  const currentUserId = createMemo(() => readyData.data?.user.id);

  // Fetch messages when channel changes
  createEffect(
    on(channelId, (id) => {
      if (id && !getMessages(id)) {
        fetchMessages(id);
      }
    }),
  );

  // Auto-scroll to bottom on new messages if user is at bottom
  createEffect(
    on(
      () => messages().length,
      () => {
        if (isAtBottom && scrollRef) {
          queueMicrotask(() => {
            scrollRef.scrollTop = scrollRef.scrollHeight;
          });
        }
      },
    ),
  );

  function handleScroll() {
    if (!scrollRef) return;
    isAtBottom =
      scrollRef.scrollTop + scrollRef.clientHeight >= scrollRef.scrollHeight - 100;
  }

  function loadMore() {
    const id = channelId();
    if (id) fetchMessages(id);
  }

  return (
    <div class="flex h-full flex-col">
      <Show when={channelName()}>
        {(name) => (
          <>
            <div class="flex h-12 shrink-0 items-center border-b border-border px-4">
              <span class="font-semibold text-text-primary"># {name()}</span>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              class="flex flex-1 flex-col overflow-y-auto"
            >
              <Show when={hasMore() && !loading()}>
                <div class="flex justify-center py-2">
                  <button
                    onClick={loadMore}
                    class="text-xs text-brand hover:underline"
                  >
                    Load older messages
                  </button>
                </div>
              </Show>

              <Show when={loading()}>
                <div class="flex justify-center py-4">
                  <div class="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                </div>
              </Show>

              <div class="mt-auto" />

              <Show
                when={messages().length > 0}
                fallback={
                  <Show when={!loading()}>
                    <div class="flex flex-1 items-center justify-center pb-4">
                      <p class="text-text-muted">No messages yet. Start the conversation!</p>
                    </div>
                  </Show>
                }
              >
                <div class="py-2">
                  <For each={messages()}>
                    {(msg) => (
                      <MessageBubble
                        message={msg}
                        isOwn={msg.author.id === currentUserId()}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <MessageInput channelId={channelId() ?? ''} />
          </>
        )}
      </Show>
      <Show when={!channelName()}>
        <div class="flex flex-1 items-center justify-center">
          <p class="text-text-muted">Select a channel to start chatting</p>
        </div>
      </Show>
    </div>
  );
};

export default ChatArea;
