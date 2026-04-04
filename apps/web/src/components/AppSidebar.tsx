import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { Portal } from "solid-js/web";
import { useSession, signOut } from "../lib/auth.js";
import { readyData, channelCacheLoading, gatewayStatus } from "../lib/gateway-store.js";
import {
  selectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  selectHome,
  currentServer,
  currentChannels,
} from "../stores/app-store.js";
import { getUnreadCount, getTotalDmUnread } from "../stores/notification-store.js";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar.js";
import ServerSwitcher from "./ServerSwitcher.js";
import CreateServerModal from "./modals/CreateServerModal.js";
import CreateChannelModal from "./modals/CreateChannelModal.js";
import JoinServerModal from "./modals/JoinServerModal.js";
import InviteModal from "./modals/InviteModal.js";
import CheckoutModal from "./modals/CheckoutModal.js";
import SubscriptionModal from "./modals/SubscriptionModal.js";
import PricingModal from "./modals/PricingModal.js";
import UnifiedReportDialog from "./modals/UnifiedReportDialog.js";
import ShareFileModal from "./modals/ShareFileModal.js";
import AddFriendModal from "./modals/AddFriendModal.js";
import CommandPalette from "./CommandPalette.js";
import { commandPaletteOpen, setCommandPaletteOpen } from "../stores/command-palette-store.js";
import {
  isDesktop,
  visiblePlugins,
  activePluginId,
  setActivePluginId,
  clearActivePlugin,
  visibleServerPlugins,
  activeServerPluginId,
  setActiveServerPluginId,
  fetchServerPlugins,
  clearServerPlugins,
  resolvePluginAssetUrl,
} from "../stores/plugin-store.js";
import SupportSheet from "./SupportSheet.js";
import { showToast } from "./ui/toast.js";
import { UpdatePill } from "./ui/update-pill.js";

const AppSidebar = () => {
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const closeMobile = () => setOpenMobile(false);
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [modal, setModal] = createSignal<"create" | "join" | "invite" | "create-channel" | null>(
    null,
  );
  const [copiedUsername, setCopiedUsername] = createSignal(false);
  const [checkoutTier, setCheckoutTier] = createSignal<"supporter" | "server_owner" | null>(null);
  const [showPricingModal, setShowPricingModal] = createSignal(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);
  const [showReportDialog, setShowReportDialog] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [showAddFriendModal, setShowAddFriendModal] = createSignal(false);
  const [showSupportSheet, setShowSupportSheet] = createSignal(false);
  const [userDropdownOpen, setUserDropdownOpen] = createSignal(false);
  const [dropdownPos, setDropdownPos] = createSignal({ bottom: 0, left: 0 });

  let copiedUsernameTimer: ReturnType<typeof setTimeout> | undefined;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let footerRef!: HTMLDivElement;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let triggerRef!: HTMLButtonElement;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let menuRef!: HTMLDivElement;
  onCleanup(() => clearTimeout(copiedUsernameTimer));

  const copyUsername = async () => {
    const u = readyData.data?.user;
    const username = u?.username ?? session()?.data?.user?.name ?? "User";
    try {
      await navigator.clipboard.writeText(username);
      showToast("Username copied", "info");
      setCopiedUsername(true);
      clearTimeout(copiedUsernameTimer);
      copiedUsernameTimer = setTimeout(() => setCopiedUsername(false), 1500);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AppSidebar] clipboard write failed:", err);
    }
  };

  const resolvedUsername = () =>
    readyData.data?.user.username ?? session()?.data?.user?.name ?? "User";
  const resolvedDisplayName = () => readyData.data?.user.displayName ?? resolvedUsername();

  const isServerOwner = () =>
    currentServer()?.ownerId != null && currentServer()?.ownerId === readyData.data?.user.id;

  const isPaidUser = () =>
    readyData.data?.user.subscriptionTier !== undefined &&
    readyData.data?.user.subscriptionTier !== "free";

  // Fetch server plugins when switching servers (only after gateway connects)
  createEffect(() => {
    const sId = selectedServerId();
    const connected = gatewayStatus() === "connected";
    if (sId && connected) {
      fetchServerPlugins(sId);
    } else if (!sId) {
      clearServerPlugins();
    }
  });

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const openUserDropdown = () => {
    const rect = footerRef.getBoundingClientRect();
    setDropdownPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
    setUserDropdownOpen(true);
  };

  const closeUserDropdown = () => {
    setUserDropdownOpen(false);
    triggerRef?.focus();
  };

  // Focus first menu item when dropdown opens + wire Escape / focus trap
  createEffect(() => {
    if (!userDropdownOpen()) return;

    // Focus first actionable item after render
    requestAnimationFrame(() => {
      const first = menuRef?.querySelector<HTMLElement>("button, a, [tabindex]");
      first?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeUserDropdown();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = [
        ...(menuRef?.querySelectorAll<HTMLElement>("button, a, [tabindex]") ?? []),
      ];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first && last) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last && first) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  const handleCommandAction = (action: string) => {
    switch (action) {
      case "send-file":
        setShowShareModal(true);
        break;
      case "add-friend":
        setShowAddFriendModal(true);
        break;
      case "feature-requests":
        navigate("/features");
        break;
      case "support":
        setShowSupportSheet(true);
        break;
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // ── Channel group header actions ────────────────────────────────
  const channelActions = () => (
    <>
      <button
        class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Invite People"
        aria-label="Invite People"
        onClick={() => setModal("invite")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
      </button>
      <Show when={isServerOwner()}>
        <button
          class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Create Channel"
          aria-label="Create Channel"
          onClick={() => setModal("create-channel")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          type="button"
          class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Server Settings"
          aria-label="Server Settings"
          onClick={() => {
            const id = selectedServerId();
            if (id) navigate(`/servers/${id}/settings`);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </Show>
    </>
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* ── Header: Logo + Update Pill ────────────────────────────── */}
      <SidebarHeader class="drag-region flex flex-row items-center justify-between px-3 py-2">
        <SidebarMenu class="flex-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="UnCorded"
              onClick={() => {
                selectHome();
                navigate("/home");
                closeMobile();
              }}
            >
              <img src="/icon-192.png" alt="UnCorded" class="h-8 w-8 shrink-0 rounded-md" />
              <span class="truncate font-mono text-base font-bold uppercase tracking-wide text-foreground">
                UNCORDED
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Show when={isDesktop()}>
          <UpdatePill />
        </Show>
      </SidebarHeader>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <SidebarContent>
        {/* Search — opens command palette */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <Show
                when={sidebarState() === "expanded"}
                fallback={
                  <SidebarMenuButton
                    tooltip="Search (Ctrl+K)"
                    onClick={() => setCommandPaletteOpen(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span>Search</span>
                  </SidebarMenuButton>
                }
              >
                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  class="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>Search...</span>
                  <kbd class="ml-auto text-[10px] text-muted-foreground">Ctrl+K</kbd>
                </button>
              </Show>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Quick actions — Send File + Add Friend */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Send File" onClick={() => setShowShareModal(true)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span>Send File</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Add Friend" onClick={() => setShowAddFriendModal(true)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                <span>Add Friend</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Social group */}
        <SidebarGroup label="Social" collapsible defaultOpen class="px-2 py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All Friends"
                active={isActive("/friends")}
                onClick={() => {
                  selectHome();
                  navigate("/friends");
                  closeMobile();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>All Friends</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Direct Messages"
                active={isActive("/messages") || location.pathname.startsWith("/messages/")}
                onClick={() => {
                  selectHome();
                  navigate("/messages");
                  closeMobile();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span>Direct Messages</span>
                {(() => {
                  const count = getTotalDmUnread();
                  return (
                    <Show when={count > 0}>
                      <span class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {count}
                      </span>
                    </Show>
                  );
                })()}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Servers — no collapsible wrapper */}
        <SidebarGroup class="px-2 py-1">
          {/* Server selector */}
          <div
            classList={{
              "px-2": sidebarState() === "expanded",
              "px-0": sidebarState() === "collapsed",
            }}
          >
            <ServerSwitcher
              onCreateServer={() => setModal("create")}
              onJoinServer={() => setModal("join")}
            />
          </div>

          {/* Empty state — no servers yet */}
          <Show
            when={
              sidebarState() === "expanded" &&
              (!readyData.data?.servers || readyData.data.servers.length === 0) &&
              !selectedServerId()
            }
          >
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-muted-foreground">No servers yet</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  onClick={() => setModal("create")}
                >
                  Create Server
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  onClick={() => setModal("join")}
                >
                  Join Server
                </button>
              </div>
            </div>
          </Show>

          {/* Channel actions + channel list — shown when a server is selected */}
          <Show when={selectedServerId()}>
            {/* Channel actions — settings, invite, create */}
            <Show when={sidebarState() === "expanded"}>
              <Show when={isServerOwner()}>
                <div class="flex items-center gap-1 px-3 pt-1">{channelActions()}</div>
              </Show>
            </Show>

            {/* Channel list */}
            <Show
              when={channelCacheLoading() !== selectedServerId()}
              fallback={
                <Show when={sidebarState() === "expanded"}>
                  <p class="px-4 py-3 text-xs text-muted-foreground">Loading channels...</p>
                </Show>
              }
            >
              <SidebarMenu class="mt-1" classList={{ hidden: sidebarState() === "collapsed" }}>
                <For each={currentChannels()}>
                  {(channel) => {
                    const active = () => selectedChannelId() === channel.id;
                    return (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          tooltip={`# ${channel.name}`}
                          active={active()}
                          onClick={() => {
                            clearActivePlugin();
                            setSelectedChannelId(channel.id);
                            const sId = selectedServerId();
                            if (sId) navigate(`/servers/${sId}`);
                            closeMobile();
                          }}
                        >
                          <span class="font-mono text-muted-foreground">#</span>
                          <span class="truncate" title={channel.name}>
                            {channel.name}
                          </span>
                          <Show
                            when={
                              (!active() && getUnreadCount(channel.id) > 0) ||
                              channel.fileSharingEnabled
                            }
                          >
                            <span class="ml-auto flex shrink-0 items-center gap-1.5">
                              <Show when={!active() && getUnreadCount(channel.id) > 0}>
                                <span class="flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                                  {getUnreadCount(channel.id)}
                                </span>
                              </Show>
                              <Show when={channel.fileSharingEnabled}>
                                <span
                                  class="h-2 w-2 shrink-0 rounded-full bg-success"
                                  title="File sharing enabled"
                                />
                              </Show>
                            </span>
                          </Show>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }}
                </For>
              </SidebarMenu>
            </Show>
          </Show>
        </SidebarGroup>

        {/* Server Plugins — footer area */}
        <Show when={selectedServerId() && visibleServerPlugins().length > 0}>
          <SidebarGroup label="Server Plugins" collapsible defaultOpen class="mt-auto px-2 py-1">
            <SidebarMenu classList={{ hidden: sidebarState() === "collapsed" }}>
              <For each={visibleServerPlugins()}>
                {(plugin) => {
                  const isPluginActive = () => activeServerPluginId() === plugin.pluginId;
                  // Format pluginId as display name: "claude-code" → "Claude Code"
                  const displayName = () =>
                    plugin.pluginId
                      .split(/[-_]/)
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ");
                  return (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip={displayName()}
                        active={isPluginActive()}
                        onClick={() => {
                          setActiveServerPluginId(plugin.pluginId);
                          clearActivePlugin();
                          const sId = selectedServerId();
                          if (sId) navigate(`/servers/${sId}`);
                          closeMobile();
                        }}
                      >
                        <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                            />
                          </svg>
                          <span
                            class="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-success"
                            aria-hidden="true"
                          />
                        </span>
                        <span class="truncate" title={displayName()}>
                          {displayName()}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }}
              </For>
            </SidebarMenu>
          </SidebarGroup>
        </Show>

        {/* My Plugins — desktop only */}
        <Show when={isDesktop() && visiblePlugins().length > 0}>
          <SidebarGroup
            label={selectedServerId() ? "My Plugins" : "Plugins"}
            collapsible
            defaultOpen
            class={`px-2 py-1 ${!(selectedServerId() && visibleServerPlugins().length > 0) ? "mt-auto" : ""}`}
          >
            <SidebarMenu classList={{ hidden: sidebarState() === "collapsed" }}>
              <div class="max-h-40 overflow-y-auto">
                <For each={visiblePlugins()}>
                  {(plugin) => {
                    const isPluginActive = () => activePluginId() === plugin.id;
                    const [imgFailed, setImgFailed] = createSignal(false);
                    const statusColor = (): string => {
                      switch (plugin.status) {
                        case "running":
                          return "bg-success";
                        case "starting":
                          return "bg-warning";
                        case "crashed":
                          return "bg-destructive";
                        default:
                          return "bg-muted-foreground";
                      }
                    };
                    return (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          tooltip={plugin.name}
                          active={isPluginActive()}
                          onClick={() => {
                            setActivePluginId(plugin.id);
                            setActiveServerPluginId(null);
                            const sId = selectedServerId();
                            if (sId) navigate(`/servers/${sId}`);
                            closeMobile();
                          }}
                        >
                          <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                            <Show
                              when={plugin.icon && !imgFailed()}
                              fallback={
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  aria-hidden="true"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                                  />
                                </svg>
                              }
                            >
                              <Show
                                when={plugin.icon!.startsWith("/")}
                                fallback={<span class="text-sm">{plugin.icon}</span>}
                              >
                                <img
                                  src={resolvePluginAssetUrl(plugin, plugin.icon!)}
                                  alt=""
                                  class="h-4 w-4"
                                  onError={() => setImgFailed(true)}
                                />
                              </Show>
                            </Show>
                            <span
                              class={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${statusColor()}`}
                              aria-hidden="true"
                              title={plugin.status}
                            />
                            <span class="sr-only">Status: {plugin.status}</span>
                          </span>
                          <span class="truncate" title={plugin.name}>
                            {plugin.name}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }}
                </For>
              </div>
            </SidebarMenu>
          </SidebarGroup>
        </Show>

        {/* Bottom nav — Support & Settings */}
        <SidebarGroup
          class={`px-2 py-1 ${!(selectedServerId() && visibleServerPlugins().length > 0) && !(isDesktop() && visiblePlugins().length > 0) ? "mt-auto" : ""}`}
        >
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                tooltip="Support"
                onClick={() => setShowSupportSheet(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span>Support</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                tooltip="Settings"
                active={location.pathname.startsWith("/settings")}
                onClick={() => {
                  navigate("/settings");
                  closeMobile();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: User Card + Dropdown ────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div ref={footerRef}>
              <SidebarMenuButton
                ref={triggerRef}
                size="lg"
                tooltip={resolvedDisplayName()}
                onClick={openUserDropdown}
                aria-expanded={userDropdownOpen()}
                aria-haspopup="menu"
                class="data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <Show
                  when={readyData.data?.user.avatarUrl}
                  fallback={
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                      {resolvedDisplayName().charAt(0).toUpperCase()}
                    </div>
                  }
                >
                  {(url) => (
                    <img
                      src={url()}
                      alt={resolvedDisplayName()}
                      class="h-8 w-8 shrink-0 rounded-lg object-cover"
                    />
                  )}
                </Show>
                <div class="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium" title={resolvedDisplayName()}>
                    {resolvedDisplayName()}
                  </span>
                  <span
                    class="truncate text-xs text-muted-foreground"
                    title={`@${resolvedUsername()}`}
                  >
                    @{resolvedUsername()}
                  </span>
                </div>
                {/* ChevronsUpDown icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="ml-auto h-4 w-4 shrink-0 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 15l5 5 5-5" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 9l5-5 5 5" />
                </svg>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* ── User Dropdown Menu ──────────────────────────────────────── */}
      <Show when={userDropdownOpen()}>
        <Portal mount={document.body}>
          <div class="fixed inset-0 z-[60]" onClick={closeUserDropdown} />
          <div
            ref={menuRef}
            role="menu"
            class="fixed z-[60] w-56 rounded-md border border-border bg-popover p-1 shadow-md"
            style={{
              bottom: `${dropdownPos().bottom}px`,
              left: `${dropdownPos().left}px`,
            }}
          >
            {/* Profile header */}
            <div class="flex items-center gap-2 px-2 py-2">
              <Show
                when={readyData.data?.user.avatarUrl}
                fallback={
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {resolvedDisplayName().charAt(0).toUpperCase()}
                  </div>
                }
              >
                {(url) => (
                  <img
                    src={url()}
                    alt={resolvedDisplayName()}
                    class="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                )}
              </Show>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-foreground">
                  {resolvedDisplayName()}
                </div>
                <button
                  type="button"
                  class="truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyUsername();
                  }}
                >
                  {copiedUsername() ? "Copied!" : `@${resolvedUsername()}`}
                </button>
              </div>
            </div>

            <div class="mx-1 my-1 h-px bg-border" />

            <Show when={!isPaidUser()}>
              <button
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
                onClick={() => {
                  closeUserDropdown();
                  navigate("/settings/upgrade");
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
                Upgrade to Supporter
              </button>
              <div role="separator" class="mx-1 my-1 h-px bg-border" />
            </Show>

            <button
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => {
                closeUserDropdown();
                navigate("/settings/account");
              }}
            >
              Account
            </button>
            <button
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => {
                closeUserDropdown();
                navigate("/settings/billing");
              }}
            >
              Billing
            </button>
            <button
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => {
                closeUserDropdown();
                navigate("/settings/notifications");
              }}
            >
              Notifications
            </button>

            <div role="separator" class="mx-1 my-1 h-px bg-border" />

            <button
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => {
                closeUserDropdown();
                setShowReportDialog(true);
              }}
            >
              Report Bug
            </button>
            <button
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-accent"
              onClick={() => {
                closeUserDropdown();
                handleLogout();
              }}
            >
              Log out
            </button>
          </div>
        </Portal>
      </Show>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <Show when={modal() === "create"}>
        <CreateServerModal onClose={() => setModal(null)} />
      </Show>
      <Show when={modal() === "join"}>
        <JoinServerModal onClose={() => setModal(null)} />
      </Show>
      <Show when={modal() === "invite" && currentServer()}>
        {(server) => <InviteModal serverId={server().id} onClose={() => setModal(null)} />}
      </Show>
      <Show when={modal() === "create-channel" && currentServer()}>
        {(server) => <CreateChannelModal serverId={server().id} onClose={() => setModal(null)} />}
      </Show>
      <Show when={checkoutTier()}>
        {(tier) => <CheckoutModal tier={tier()} onClose={() => setCheckoutTier(null)} />}
      </Show>
      <Show when={showSubscriptionModal()}>
        <SubscriptionModal
          onClose={() => setShowSubscriptionModal(false)}
          onCheckout={(tier) => {
            setShowSubscriptionModal(false);
            setCheckoutTier(tier);
          }}
        />
      </Show>
      <Show when={showPricingModal()}>
        <PricingModal
          onClose={() => setShowPricingModal(false)}
          onSelect={(tier) => {
            setShowPricingModal(false);
            setCheckoutTier(tier);
          }}
        />
      </Show>
      <Show when={showReportDialog()}>
        <UnifiedReportDialog onClose={() => setShowReportDialog(false)} />
      </Show>
      <Show when={showShareModal()}>
        <ShareFileModal onClose={() => setShowShareModal(false)} />
      </Show>
      <Show when={showAddFriendModal()}>
        <AddFriendModal onClose={() => setShowAddFriendModal(false)} />
      </Show>
      <CommandPalette
        open={commandPaletteOpen()}
        onClose={() => setCommandPaletteOpen(false)}
        onAction={handleCommandAction}
      />
      <SupportSheet
        open={showSupportSheet()}
        onClose={() => setShowSupportSheet(false)}
        onReportBug={() => setShowReportDialog(true)}
      />
    </Sidebar>
  );
};

export default AppSidebar;
