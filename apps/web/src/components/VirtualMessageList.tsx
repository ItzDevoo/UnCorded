import { createMemo, createEffect, on, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { ChannelId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import MessageBubble from "./MessageBubble.js";

const SCROLL_BOTTOM_THRESHOLD = 100;
const OVERSCAN = 5;

const VirtualMessageList = (props: { channelId: ChannelId }) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let scrollRef!: HTMLDivElement;

  const channelData = createMemo(() => getMessages(props.channelId));
  const messages = createMemo(() => channelData()?.messages ?? []);
  const loading = createMemo(() => channelData()?.loading ?? false);
  const hasMore = createMemo(() => channelData()?.hasMore ?? false);
  const currentUserId = createMemo(() => readyData.data?.user.id);

  // Fetch on mount if needed
  createEffect(
    on(
      () => props.channelId,
      (id) => {
        if (id && !getMessages(id)) {
          fetchMessages(id);
        }
      },
    ),
  );

  const virtualizer = createVirtualizer({
    get count() {
      return messages().length;
    },
    getScrollElement: () => scrollRef,
    estimateSize: () => 44,
    overscan: OVERSCAN,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Auto-scroll to bottom on new messages
  createEffect(
    on(
      () => messages().length,
      (len, prevLen) => {
        if (!scrollRef || len === 0) return;
        const isNearBottom =
          scrollRef.scrollTop + scrollRef.clientHeight >=
          scrollRef.scrollHeight - SCROLL_BOTTOM_THRESHOLD;

        if (isNearBottom || (prevLen ?? 0) === 0) {
          queueMicrotask(() => {
            virtualizer.scrollToIndex(len - 1, { align: "end" });
          });
        }
      },
    ),
  );

  function handleScroll() {
    if (!scrollRef || loading()) return;

    // Load more when scrolled to top
    if (scrollRef.scrollTop === 0 && hasMore()) {
      fetchMessages(props.channelId);
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      class="flex-1 overflow-y-auto"
    >
      <Show when={loading()}>
        <div class="flex justify-center py-4">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Show>

      <Show
        when={messages().length > 0}
        fallback={
          <Show when={!loading()}>
            <div class="flex h-full items-center justify-center pb-4">
              <p class="text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          </Show>
        }
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages()[virtualRow.index];
            if (!msg) return null;
            return (
              <div
                data-index={virtualRow.index}
                ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageBubble
                  message={msg}
                  isOwn={msg.author.id === currentUserId()}
                />
              </div>
            );
          })}
        </div>
      </Show>
    </div>
  );
};

export default VirtualMessageList;
