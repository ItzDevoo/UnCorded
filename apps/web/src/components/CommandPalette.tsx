import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { readyData, channelCache } from "../lib/gateway-store.js";
import { setSelectedChannelId } from "../stores/app-store.js";
import type { ReadyFriend, ReadyChannel } from "../lib/gateway-store.js";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

interface ResultItem {
  id: string;
  label: string;
  sublabel?: string | undefined;
  category: "Friends" | "Servers" | "Channels" | "Actions";
  onSelect: () => void;
}

const CommandPalette = (props: CommandPaletteProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef!: HTMLInputElement;
  let listRef!: HTMLDivElement;

  // Reset state and focus input whenever the palette opens
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setQuery("");
        setSelectedIndex(0);
        requestAnimationFrame(() => inputRef?.focus());
      },
    ),
  );

  const allResults = createMemo<ResultItem[]>(() => {
    const q = query().trim().toLowerCase();
    const results: ResultItem[] = [];
    const data = readyData.data;
    if (!data) return results;

    // Friends — only accepted friends
    const friends = data.friends.filter((f) => f.friendshipStatus === "accepted");
    const matchedFriends = q
      ? friends.filter((f) => matchUser(f, q))
      : friends;
    for (const f of matchedFriends.slice(0, 8)) {
      results.push({
        id: `friend-${f.userId}`,
        label: f.displayName ?? f.username ?? "Unknown",
        sublabel: f.username ? `@${f.username}` : undefined,
        category: "Friends",
        onSelect: () => {
          navigate(`/messages/${f.userId}`);
          props.onClose();
        },
      });
    }

    // Servers
    const matchedServers = q
      ? data.servers.filter((s) => s.name.toLowerCase().includes(q))
      : data.servers;
    for (const s of matchedServers.slice(0, 8)) {
      results.push({
        id: `server-${s.id}`,
        label: s.name,
        category: "Servers",
        onSelect: () => {
          navigate(`/servers/${s.id}`);
          props.onClose();
        },
      });
    }

    // Channels — iterate cached channels for all servers
    const channels: (ReadyChannel & { serverName: string })[] = [];
    for (const server of data.servers) {
      const serverChannels = channelCache[server.id];
      if (!serverChannels) continue;
      for (const ch of serverChannels) {
        channels.push({ ...ch, serverName: server.name });
      }
    }
    const matchedChannels = q
      ? channels.filter((ch) => ch.name.toLowerCase().includes(q))
      : channels;
    for (const ch of matchedChannels.slice(0, 8)) {
      results.push({
        id: `channel-${ch.id}`,
        label: `# ${ch.name}`,
        sublabel: ch.serverName,
        category: "Channels",
        onSelect: () => {
          setSelectedChannelId(ch.id);
          navigate(`/servers/${ch.serverId}`);
          props.onClose();
        },
      });
    }

    // Actions — static list, always shown when matching or when query is empty
    const actions: { id: string; label: string; action: string }[] = [
      { id: "action-send-file", label: "Send File", action: "send-file" },
      { id: "action-add-friend", label: "Add Friend", action: "add-friend" },
      { id: "action-settings", label: "Settings", action: "settings" },
      { id: "action-feature-requests", label: "Feature Requests", action: "feature-requests" },
      { id: "action-support", label: "Support", action: "support" },
    ];
    const matchedActions = q
      ? actions.filter((a) => a.label.toLowerCase().includes(q))
      : actions;
    for (const a of matchedActions) {
      results.push({
        id: a.id,
        label: a.label,
        category: "Actions",
        onSelect: () => {
          props.onAction(a.action);
          props.onClose();
        },
      });
    }

    return results;
  });

  // Group results by category for rendering
  const groupedResults = createMemo(() => {
    const groups: { category: string; items: ResultItem[] }[] = [];
    const categoryOrder: ResultItem["category"][] = ["Friends", "Servers", "Channels", "Actions"];

    for (const cat of categoryOrder) {
      const items = allResults().filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  });

  // Flatten for index-based keyboard nav
  const flatResults = createMemo(() => allResults());

  const handleKeyDown = (e: KeyboardEvent) => {
    const total = flatResults().length;
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % total);
      scrollToSelected();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + total) % total);
      scrollToSelected();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatResults()[selectedIndex()];
      item?.onSelect();
    }
  };

  const scrollToSelected = () => {
    requestAnimationFrame(() => {
      const el = listRef?.querySelector<HTMLElement>(`[data-index="${selectedIndex()}"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
  };

  // Reset index when query changes
  const handleInput = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  // Category icon
  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "Friends":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "Servers":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        );
      case "Channels":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        );
      case "Actions":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Track flat index across grouped rendering
  let flatIdx = 0;

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          onClick={props.onClose}
        >
          {/* Backdrop */}
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Palette */}
          <div
            class="relative mx-4 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div class="flex items-center gap-2 border-b border-border px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search friends, servers, channels..."
                value={query()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                class="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <kbd class="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} class="max-h-80 overflow-y-auto p-2">
              <Show
                when={flatResults().length > 0}
                fallback={
                  <p class="px-2 py-6 text-center text-sm text-muted-foreground">
                    {query().trim() ? "No results found." : "Start typing to search..."}
                  </p>
                }
              >
                {(() => {
                  flatIdx = 0;
                  return null;
                })()}
                <For each={groupedResults()}>
                  {(group) => (
                    <div class="mb-2 last:mb-0">
                      <div class="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        {categoryIcon(group.category)}
                        {group.category}
                      </div>
                      <For each={group.items}>
                        {(item) => {
                          const idx = flatIdx++;
                          return (
                            <button
                              type="button"
                              data-index={idx}
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                              classList={{
                                "bg-accent text-foreground": selectedIndex() === idx,
                                "text-secondary-foreground hover:bg-accent hover:text-foreground": selectedIndex() !== idx,
                              }}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              onClick={() => item.onSelect()}
                            >
                              <span class="flex-1 truncate">{item.label}</span>
                              <Show when={item.sublabel}>
                                <span class="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

function matchUser(f: ReadyFriend, q: string): boolean {
  const name = (f.displayName ?? "").toLowerCase();
  const uname = (f.username ?? "").toLowerCase();
  return name.includes(q) || uname.includes(q);
}

export default CommandPalette;
