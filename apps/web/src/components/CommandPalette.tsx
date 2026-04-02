import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { readyData, channelCache } from "../lib/gateway-store.js";
import { setSelectedChannelId } from "../stores/app-store.js";
import { useSidebar } from "./ui/sidebar.js";
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
  category: "Friends" | "Servers" | "Channels" | "Settings" | "Actions";
  onSelect: () => void;
}

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
    case "Settings":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

const CommandPalette = (props: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let inputRef!: HTMLInputElement;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let listRef!: HTMLDivElement;

  const closeAll = () => {
    props.onClose();
    setOpenMobile(false);
  };

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

    // Friends — only accepted friends (skip if gateway not ready)
    const friends = data ? data.friends.filter((f) => f.friendshipStatus === "accepted") : [];
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
          closeAll();
        },
      });
    }

    // Servers
    const servers = data?.servers ?? [];
    const matchedServers = q
      ? servers.filter((s) => s.name.toLowerCase().includes(q))
      : servers;
    for (const s of matchedServers.slice(0, 8)) {
      results.push({
        id: `server-${s.id}`,
        label: s.name,
        category: "Servers",
        onSelect: () => {
          navigate(`/servers/${s.id}`);
          closeAll();
        },
      });
    }

    // Channels — iterate cached channels for all servers
    const channels: (ReadyChannel & { serverName: string })[] = [];
    for (const server of servers) {
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
          closeAll();
        },
      });
    }

    // Settings pages
    const settingsPages = [
      { id: "settings-profile", label: "Profile", href: "/settings/profile" },
      { id: "settings-account", label: "Account", href: "/settings/account" },
      { id: "settings-appearance", label: "Appearance", href: "/settings/appearance" },
      { id: "settings-transfers", label: "Transfers", href: "/settings/transfers" },
      { id: "settings-bots", label: "Bots", href: "/settings/bots" },
      { id: "settings-plugins", label: "Plugins", href: "/settings/plugins" },
      { id: "settings-upgrade", label: "Upgrade", href: "/settings/upgrade" },
      { id: "settings-billing", label: "Billing", href: "/settings/billing" },
      { id: "settings-notifications", label: "Notifications", href: "/settings/notifications" },
    ];
    const matchedSettings = q
      ? settingsPages.filter((s) => s.label.toLowerCase().includes(q))
      : settingsPages;
    for (const s of matchedSettings) {
      results.push({
        id: s.id,
        label: s.label,
        sublabel: "Settings",
        category: "Settings",
        onSelect: () => {
          navigate(s.href);
          closeAll();
        },
      });
    }

    // Actions — static list, always shown when matching or when query is empty
    const actions: { id: string; label: string; action: string }[] = [
      { id: "action-send-file", label: "Send File", action: "send-file" },
      { id: "action-add-friend", label: "Add Friend", action: "add-friend" },
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

  // Group results by category with precomputed flat indices for keyboard nav
  interface IndexedItem extends ResultItem {
    flatIndex: number;
  }
  const groupedResults = createMemo(() => {
    const groups: { category: string; items: IndexedItem[] }[] = [];
    const categoryOrder: ResultItem["category"][] = ["Friends", "Servers", "Channels", "Settings", "Actions"];
    let idx = 0;

    for (const cat of categoryOrder) {
      const items: IndexedItem[] = [];
      for (const r of allResults()) {
        if (r.category === cat) {
          items.push({ ...r, flatIndex: idx++ });
        }
      }
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const total = allResults().length;
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
      const item = allResults()[selectedIndex()];
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
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
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
                aria-label="Search friends, servers, channels"
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
                when={allResults().length > 0}
                fallback={
                  <p class="px-2 py-6 text-center text-sm text-muted-foreground">
                    {query().trim() ? "No results found." : "Start typing to search..."}
                  </p>
                }
              >
                <For each={groupedResults()}>
                  {(group) => (
                    <div class="mb-2 last:mb-0">
                      <div class="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        {categoryIcon(group.category)}
                        {group.category}
                      </div>
                      <For each={group.items}>
                        {(item) => (
                          <button
                            type="button"
                            data-index={item.flatIndex}
                            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                            classList={{
                              "bg-accent text-foreground": selectedIndex() === item.flatIndex,
                              "text-secondary-foreground hover:bg-accent hover:text-foreground": selectedIndex() !== item.flatIndex,
                            }}
                            onMouseEnter={() => setSelectedIndex(item.flatIndex)}
                            onClick={() => item.onSelect()}
                          >
                            <span class="flex-1 truncate">{item.label}</span>
                            <Show when={item.sublabel}>
                              <span class="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>
                            </Show>
                          </button>
                        )}
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
