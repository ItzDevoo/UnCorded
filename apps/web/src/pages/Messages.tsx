import { For, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import type { DmChannelId, UserId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { selectDmChannel } from "../stores/app-store.js";
import { fetchMoreDms, loadingMoreDms } from "../stores/friend-store.js";
import { getUnreadCount } from "../stores/notification-store.js";
import StatusDot, { type UserStatus } from "../components/StatusDot.js";
import { Empty } from "../components/ui/empty.js";
import ContentHeader from "../components/ContentHeader.js";

const Messages = () => {
  const navigate = useNavigate();
  const params = useParams<{ userId?: string }>();

  const handleSelect = (dmId: DmChannelId, userId: UserId) => {
    selectDmChannel(dmId);
    navigate(`/messages/${userId}`);
  };

  // Derive active state from route param, not global selection
  const activeUserId = () => params.userId;

  return (
    <div class="flex h-full flex-col">
      <ContentHeader title="Direct Messages" breadcrumbs={[{ label: "Social", href: "/home" }]} />

      <div class="flex-1 overflow-y-auto">
        <Show
          when={(readyData.data?.dmChannels ?? []).length > 0}
          fallback={
            <Empty
              title="No conversations yet"
              description="Start a DM from the Friends page"
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
            />
          }
        >
          <div class="flex flex-col">
            <For each={readyData.data?.dmChannels}>
              {(dm) => {
                const displayName = () =>
                  dm.otherUser.displayName ?? dm.otherUser.username ?? "Unknown";
                const initial = () => displayName().charAt(0).toUpperCase();
                const isActive = () => activeUserId() === dm.otherUser.id;
                const unread = () => getUnreadCount(dm.id);

                return (
                  <button
                    type="button"
                    class={`flex items-center gap-3 px-6 py-3 text-left transition-colors ${
                      isActive()
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => handleSelect(dm.id, dm.otherUser.id)}
                  >
                    <div class="relative shrink-0">
                      <Show
                        when={dm.otherUser.avatarUrl}
                        fallback={
                          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                            {initial()}
                          </div>
                        }
                      >
                        {(url) => (
                          <img
                            src={url()}
                            alt={displayName()}
                            class="h-10 w-10 rounded-md object-cover"
                          />
                        )}
                      </Show>
                      <StatusDot
                        status={dm.otherUser.status as UserStatus}
                        size="sm"
                        borderClass="border-background"
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-sm font-medium text-foreground">
                          {displayName()}
                        </span>
                        <Show when={!isActive() && unread() > 0}>
                          <span class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-md bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                            {unread()}
                          </span>
                        </Show>
                      </div>
                      <p class="truncate font-mono text-xs text-muted-foreground">
                        @{dm.otherUser.username ?? "unknown"}
                      </p>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
          <Show when={readyData.data?.hasMoreDmChannels}>
            <button
              class="mx-6 my-3 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              disabled={loadingMoreDms()}
              onClick={() => fetchMoreDms()}
            >
              {loadingMoreDms() ? "Loading..." : "Load more"}
            </button>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Messages;
