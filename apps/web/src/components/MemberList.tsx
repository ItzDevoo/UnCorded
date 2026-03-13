import { createMemo, For, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { ServerId, UserId } from "@uncorded/protocol";
import { getMembers, getMembersLoading, type Member } from "../stores/member-store.js";
import { ScrollArea } from "./ui/scroll-area.js";
import { Skeleton } from "./ui/skeleton.js";
import StatusDot, { type UserStatus } from "./StatusDot.js";

interface MemberListProps {
  serverId: ServerId;
  ownerId: UserId;
}

const ITEM_HEIGHT = 44;
const OVERSCAN = 5;

const MemberList = (props: MemberListProps) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let scrollRef!: HTMLDivElement;

  const members = createMemo(() => getMembers(props.serverId));
  const loading = createMemo(() => getMembersLoading(props.serverId));

  const onlineMembers = createMemo(() => members().filter((m) => m.status !== "offline"));
  const offlineMembers = createMemo(() => members().filter((m) => m.status === "offline"));

  // Sort: owner first within each group, then alphabetical
  const sortedMembers = createMemo(() => {
    const sortFn = (a: Member, b: Member) => {
      if (a.userId === props.ownerId) return -1;
      if (b.userId === props.ownerId) return 1;
      const nameA = a.displayName ?? a.username ?? "";
      const nameB = b.displayName ?? b.username ?? "";
      return nameA.localeCompare(nameB);
    };
    return [...onlineMembers().toSorted(sortFn), ...offlineMembers().toSorted(sortFn)];
  });

  // Track where offline section starts for rendering the divider
  const offlineStartIndex = createMemo(() => onlineMembers().length);

  const virtualizer = createVirtualizer({
    get count() {
      return sortedMembers().length;
    },
    getScrollElement: () => scrollRef,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div class="flex h-full w-60 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div class="shrink-0 border-b border-border px-3 py-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Members — {onlineMembers().length} online, {members().length} total
        </h3>
      </div>

      {/* Member list */}
      <Show
        when={!loading()}
        fallback={
          <div class="space-y-2 p-3">
            <For each={Array.from({ length: 8 })}>
              {() => <Skeleton class="h-9 w-full rounded" />}
            </For>
          </div>
        }
      >
        <ScrollArea ref={scrollRef} class="min-h-0 flex-1">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            <For each={virtualizer.getVirtualItems()}>
              {(virtualRow) => {
                const member = () => sortedMembers()[virtualRow.index];
                const isOfflineDivider = () =>
                  virtualRow.index === offlineStartIndex() && offlineStartIndex() > 0;

                return (
                  <Show when={member()}>
                    {(m) => (
                      <div
                        data-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <Show when={isOfflineDivider()}>
                          <div class="px-3 pt-1">
                            <div class="mb-1 h-px bg-border" />
                          </div>
                        </Show>
                        <MemberRow member={m()} isOwner={m().userId === props.ownerId} />
                      </div>
                    )}
                  </Show>
                );
              }}
            </For>
          </div>
        </ScrollArea>
      </Show>
    </div>
  );
};

// ── Member Row ────────────────────────────────────────────────────────────────

const MemberRow = (props: { member: Member; isOwner: boolean }) => {
  const displayName = () => props.member.displayName ?? props.member.username ?? "Unknown";
  const initial = () => displayName()[0]?.toUpperCase() ?? "?";

  return (
    <div
      class={`flex items-center gap-2.5 px-3 py-1.5 ${props.member.status !== "offline" ? "" : "opacity-50"}`}
      title={displayName()}
    >
      {/* Avatar with online indicator */}
      <div class="relative shrink-0">
        <Show
          when={props.member.avatarUrl}
          fallback={
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initial()}
            </div>
          }
        >
          {(url) => (
            <img src={url()} alt={displayName()} class="h-8 w-8 rounded-full object-cover" />
          )}
        </Show>
        <StatusDot status={props.member.status as UserStatus} />
      </div>

      {/* Name */}
      <span class="min-w-0 truncate text-sm text-foreground">
        {displayName()}
        <Show when={props.isOwner}>
          <span class="ml-1 text-xs text-warning" title="Server Owner">
            &#9733;
          </span>
        </Show>
      </span>
    </div>
  );
};

export default MemberList;
