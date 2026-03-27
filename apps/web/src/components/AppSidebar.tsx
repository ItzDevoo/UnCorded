import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { Portal } from "solid-js/web";
import { useSession, signOut } from "../lib/auth.js";
import { readyData, channelCacheLoading } from "../lib/gateway-store.js";
import {
  selectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  selectHome,
  currentServer,
  currentChannels,
} from "../stores/app-store.js";
import { getUnreadCount } from "../stores/notification-store.js";
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
import { showToast } from "./ui/toast.js";

const AppSidebar = () => {
  const { setOpenMobile } = useSidebar();
  const closeMobile = () => setOpenMobile(false);
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [modal, setModal] = createSignal<
    "create" | "join" | "invite" | "create-channel" | null
  >(null);
  const [copiedUsername, setCopiedUsername] = createSignal(false);
  const [checkoutTier, setCheckoutTier] = createSignal<"supporter" | "server_owner" | null>(null);
  const [showPricingModal, setShowPricingModal] = createSignal(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);
  const [showReportDialog, setShowReportDialog] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [userDropdownOpen, setUserDropdownOpen] = createSignal(false);
  const [dropdownPos, setDropdownPos] = createSignal({ bottom: 0, left: 0 });

  let copiedUsernameTimer: ReturnType<typeof setTimeout> | undefined;
  let footerRef!: HTMLDivElement;
  let triggerRef!: HTMLButtonElement;
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
  const resolvedDisplayName = () =>
    readyData.data?.user.displayName ?? resolvedUsername();

  const isServerOwner = () =>
    currentServer()?.ownerId != null &&
    currentServer()?.ownerId === readyData.data?.user.id;

  const isPaidUser = () =>
    readyData.data?.user.subscriptionTier !== undefined &&
    readyData.data?.user.subscriptionTier !== "free";

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

      const focusable = [...(menuRef?.querySelectorAll<HTMLElement>("button, a, [tabindex]") ?? [])];
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
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </button>
      <Show when={isServerOwner()}>
        <button
          class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Create Channel"
          aria-label="Create Channel"
          onClick={() => setModal("create-channel")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </Show>
    </>
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* ── Header: UNCORDED Logo ───────────────────────────────────── */}
      <SidebarHeader>
        <button
          onClick={() => {
            selectHome();
            navigate("/home");
            closeMobile();
          }}
          class="flex w-full items-center gap-2 px-1 py-2 transition-colors hover:opacity-80"
        >
          <img src="/icon-192.png" alt="UnCorded" class="h-8 w-8 rounded-md" />
          <span class="font-mono text-sm font-bold uppercase tracking-[0.12em] text-foreground">
            UNCORDED
          </span>
          <span class="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Alpha
          </span>
        </button>
      </SidebarHeader>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <SidebarContent>
        {/* Social group */}
        <SidebarGroup label="Social" collapsible defaultOpen>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={isActive("/friends")}
                onClick={() => {
                  selectHome();
                  navigate("/friends");
                  closeMobile();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                All Friends
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={isActive("/messages") || location.pathname.startsWith("/messages/")}
                onClick={() => {
                  selectHome();
                  navigate("/messages");
                  closeMobile();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Direct Messages
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Servers group */}
        <SidebarGroup label="Servers" collapsible defaultOpen>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => { setModal("join"); closeMobile(); }}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Join Server
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => { setModal("create"); closeMobile(); }}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Server
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Server selector */}
          <div class="px-2 pt-1">
            <ServerSwitcher
              onCreateServer={() => setModal("create")}
              onJoinServer={() => setModal("join")}
            />
          </div>

          {/* Channel list — shown when a server is selected */}
          <Show when={selectedServerId()}>
            <Show
              when={channelCacheLoading() !== selectedServerId()}
              fallback={
                <p class="px-4 py-3 text-xs text-muted-foreground">Loading channels...</p>
              }
            >
              <SidebarMenu class="mt-1">
                <For each={currentChannels()}>
                  {(channel) => {
                    const active = () => selectedChannelId() === channel.id;
                    return (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          active={active()}
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            const sId = selectedServerId();
                            if (sId) navigate(`/servers/${sId}`);
                            closeMobile();
                          }}
                        >
                          <span class="font-mono text-muted-foreground">#</span>
                          <span class="truncate">{channel.name}</span>
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
              <Show when={isServerOwner()}>
                <div class="flex items-center gap-1 px-3 pt-1">{channelActions()}</div>
              </Show>
            </Show>
          </Show>
        </SidebarGroup>

        {/* Send File button */}
        <div class="px-3 pt-2">
          <button
            onClick={() => setShowShareModal(true)}
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            title="Send File"
            aria-label="Send File"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Send File
          </button>
        </div>

        {/* Bottom nav — pushed to bottom */}
        <div class="mt-auto px-3 pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setShowReportDialog(true);
                  closeMobile();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Support
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={location.pathname.startsWith("/settings")}
                onClick={() => {
                  navigate("/settings");
                  closeMobile();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>

      {/* ── Footer: User Card + Dropdown ────────────────────────────── */}
      <SidebarFooter>
        <div ref={footerRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={openUserDropdown}
            aria-expanded={userDropdownOpen()}
            aria-haspopup="menu"
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent"
          >
            <Show
              when={readyData.data?.user.avatarUrl}
              fallback={
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  {resolvedDisplayName().charAt(0).toUpperCase()}
                </div>
              }
            >
              {(url) => (
                <img
                  src={url()}
                  alt={resolvedDisplayName()}
                  class="h-8 w-8 shrink-0 rounded-md object-cover"
                />
              )}
            </Show>
            <div class="min-w-0 flex-1 text-left">
              <div class="truncate text-sm font-medium text-foreground">
                {resolvedDisplayName()}
              </div>
              <div class="truncate font-mono text-xs text-muted-foreground">
                @{resolvedUsername()}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
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
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                    {resolvedDisplayName().charAt(0).toUpperCase()}
                  </div>
                }
              >
                {(url) => (
                  <img
                    src={url()}
                    alt={resolvedDisplayName()}
                    class="h-8 w-8 shrink-0 rounded-md object-cover"
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
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
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
        {(server) => (
          <CreateChannelModal serverId={server().id} onClose={() => setModal(null)} />
        )}
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
    </Sidebar>
  );
};

export default AppSidebar;
