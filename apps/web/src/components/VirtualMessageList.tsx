import { createMemo, createEffect, on, Show, For } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { AnyChannelId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import { getReceipts } from "../stores/file-store.js";
import MessageBubble from "./MessageBubble.js";
import FileMessage from "./FileMessage.js";

const SCROLL_BOTTOM_THRESHOLD = 100;
const OVERSCAN = 5;
const GROUP_GAP_MS = 5 * 60 * 1000;

const VirtualMessageList = (props: { channelId: AnyChannelId }) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let scrollRef!: HTMLDivElement;

  const channelData = createMemo(() => getMessages(props.channelId));
  const messages = createMemo(() => channelData()?.messages ?? []);
  const loading = createMemo(() => channelData()?.loading ?? false);
  const hasMore = createMemo(() => channelData()?.hasMore ?? false);
  const currentUserId = createMemo(() => readyData.data?.user.id);
  const fileReceipts = createMemo(() => getReceipts(props.channelId));

  function shouldShowHeader(index: number): boolean {
    if (index === 0) return true;
    const msgs = messages();
    const prev = msgs[index - 1];
    const curr = msgs[index];
    if (!prev || !curr) return true;
    if (prev.author.id !== curr.author.id) return true;
    const prevTime = new Date(prev.createdAt).getTime();
    const currTime = new Date(curr.createdAt).getTime();
    return currTime - prevTime > GROUP_GAP_MS;
  }

  const virtualizer = createVirtualizer({
    get count() {
      return messages().length;
    },
    getScrollElement: () => scrollRef,
    estimateSize: (i) => (shouldShowHeader(i) ? 52 : 28),
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
    <div ref={scrollRef} onScroll={handleScroll} class="min-h-0 flex-1 overflow-y-auto">
      <Show when={loading()}>
        <div class="flex min-h-[100px] justify-center py-4">
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
                  showHeader={shouldShowHeader(virtualRow.index)}
                  channelId={props.channelId}
                />
              </div>
            );
          })}
        </div>
      </Show>

      {/* File receipts for this channel (rendered below messages) */}
      <Show when={fileReceipts().length > 0}>
        <div class="px-4 py-2">
          <For each={fileReceipts()}>
            {(receipt) => (
              <FileMessage receipt={receipt} isOwn={receipt.senderId === currentUserId()} />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default VirtualMessageList;
