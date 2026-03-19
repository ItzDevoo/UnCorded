import { createMemo, createEffect, on, Show, onCleanup } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { AnyChannelId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { fetchMessages, getMessages } from "../stores/message-store.js";
import { Skeleton } from "./ui/skeleton.js";
import { Empty } from "./ui/empty.js";
import MessageBubble from "./MessageBubble.js";

const MessageSkeleton = (props: { showHeader?: boolean }) => (
  <div class="px-4 py-1">
    <Show when={props.showHeader}>
      <div class="mb-1 flex items-center gap-2">
        <Skeleton class="h-8 w-8 rounded-full" />
        <Skeleton class="h-4 w-24 rounded" />
        <Skeleton class="h-3 w-16 rounded" />
      </div>
    </Show>
    <div class="pl-10">
      <Skeleton class="h-4 w-full max-w-md rounded" />
    </div>
  </div>
);

const SCROLL_BOTTOM_THRESHOLD = 100;
const OVERSCAN = 5;
const GROUP_GAP_MS = 5 * 60 * 1000;
const HEADER_MESSAGE_HEIGHT = 52;
const COMPACT_MESSAGE_HEIGHT = 28;

const VirtualMessageList = (props: { channelId: AnyChannelId }) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let scrollRef!: HTMLDivElement;

  const channelData = createMemo(() => getMessages(props.channelId));
  const messages = createMemo(() => channelData()?.messages ?? []);
  const loading = createMemo(() => channelData()?.loading ?? false);
  const hasMore = createMemo(() => channelData()?.hasMore ?? false);
  const currentUserId = createMemo(() => readyData.data?.user.id);

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
    estimateSize: (i) => (shouldShowHeader(i) ? HEADER_MESSAGE_HEIGHT : COMPACT_MESSAGE_HEIGHT),
    overscan: OVERSCAN,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Scroll to bottom when channel changes
  createEffect(
    on(
      () => props.channelId,
      () => {
        const len = messages().length;
        if (!scrollRef || len === 0) return;
        queueMicrotask(() => {
          virtualizer.scrollToIndex(len - 1, { align: "end" });
        });
      },
    ),
  );

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
        <div class="space-y-3 py-4">
          <MessageSkeleton showHeader />
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton showHeader />
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      </Show>

      <Show
        when={messages().length > 0}
        fallback={
          <Show when={!loading()}>
            <Empty
              title="No messages yet"
              description="Start the conversation!"
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
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                  />
                </svg>
              }
              class="h-full"
            />
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
                ref={(el) => {
                  queueMicrotask(() => virtualizer.measureElement(el));
                  const observer = new ResizeObserver(() => {
                    virtualizer.measureElement(el);
                    if (scrollRef) {
                      const isNearBottom =
                        scrollRef.scrollTop + scrollRef.clientHeight >=
                        scrollRef.scrollHeight - SCROLL_BOTTOM_THRESHOLD;
                      if (isNearBottom) {
                        queueMicrotask(() => {
                          virtualizer.scrollToIndex(messages().length - 1, { align: "end" });
                        });
                      }
                    }
                  });
                  observer.observe(el);
                  onCleanup(() => observer.disconnect());
                }}
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

    </div>
  );
};

export default VirtualMessageList;
