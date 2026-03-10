import { For, Show } from "solid-js";
import { readyData } from "../lib/gateway-store.js";
import { selectedDmChannelId, selectDmChannel } from "../stores/app-store.js";

const DMList = () => {
  const dmChannels = () => readyData.data?.dmChannels ?? [];

  return (
    <div class="flex-1 overflow-y-auto p-2">
      <Show
        when={dmChannels().length > 0}
        fallback={<p class="px-2 pt-4 text-xs text-muted-foreground">No conversations yet</p>}
      >
        <For each={dmChannels()}>
          {(dm) => {
            const isActive = () => selectedDmChannelId() === dm.id;
            const displayName = () =>
              dm.otherUser.displayName ?? dm.otherUser.username ?? "Unknown";
            const initial = () => displayName().charAt(0).toUpperCase();
            const isOnline = () => dm.otherUser.status === "online";

            return (
              <button
                onClick={() => selectDmChannel(dm.id)}
                class="mt-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                classList={{
                  "bg-muted text-foreground": isActive(),
                  "text-secondary-foreground hover:bg-accent hover:text-foreground": !isActive(),
                }}
              >
                <div class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initial()}
                  <Show when={isOnline()}>
                    <div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                  </Show>
                </div>
                <span class="truncate">{displayName()}</span>
              </button>
            );
          }}
        </For>
      </Show>
    </div>
  );
};

export default DMList;
