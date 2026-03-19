import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession, signOut } from "../lib/auth.js";
import { readyData, channelCacheLoading } from "../lib/gateway-store.js";
import {
  selectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  selectedDmChannelId,
  selectDmChannel,
  selectHome,
  currentServer,
  currentChannels,
} from "../stores/app-store.js";
import { fetchMoreDms, loadingMoreDms } from "../stores/friend-store.js";
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
} from "./ui/sidebar.js";
import ServerSwitcher from "./ServerSwitcher.js";
import CreateServerModal from "./modals/CreateServerModal.js";
import CreateChannelModal from "./modals/CreateChannelModal.js";
import JoinServerModal from "./modals/JoinServerModal.js";
import InviteModal from "./modals/InviteModal.js";
import CheckoutModal from "./modals/CheckoutModal.js";
import SubscriptionModal from "./modals/SubscriptionModal.js";
import PricingModal from "./modals/PricingModal.js";
import StatusDot, { type UserStatus } from "./StatusDot.js";


const iconBtnClass =
  "rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = (props: AppSidebarProps) => {
  const session = useSession();
  const navigate = useNavigate();
  const [modal, setModal] = createSignal<"create" | "join" | "invite" | "create-channel" | null>(
    null,
  );
  const [copiedUsername, setCopiedUsername] = createSignal(false);
  const [checkoutTier, setCheckoutTier] = createSignal<"supporter" | "server_owner" | null>(null);
  const [showPricingModal, setShowPricingModal] = createSignal(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = createSignal(false);

  const isServerOwner = () =>
    currentServer()?.ownerId != null && currentServer()?.ownerId === readyData.data?.user.id;

  const isPaidUser = () =>
    readyData.data?.user.subscriptionTier !== undefined &&
    readyData.data?.user.subscriptionTier !== "free";

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // ── Group header actions ─────────────────────────────────────────────────

  const channelActions = () => (
    <>
      <button
        class={iconBtnClass}
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
          class={iconBtnClass}
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
          class={iconBtnClass}
          title="Server Settings"
          aria-label="Server Settings"
          onClick={() => navigate("/home/server-settings")}
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
    <Sidebar>
      {/* ── Header: Brand Home + Server Switcher ────────────────────── */}
      <SidebarHeader>
        <button
          onClick={() => {
            selectHome();
            navigate("/home/friends");
            props.onNavigate?.();
          }}
          class="flex w-full items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-accent"
        >
          <div class="flex min-w-0 flex-1 items-center justify-center gap-2">
            <img src="/icon-192.png" alt="UnCorded" class="h-12 w-12 rounded-lg" />
            <span class="text-sm font-semibold tracking-tight text-foreground">UnCorded</span>
            <span class="rounded-full bg-muted/50 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
              Alpha
            </span>
          </div>
        </button>
        <ServerSwitcher
          onCreateServer={() => setModal("create")}
          onJoinServer={() => setModal("join")}
        />
      </SidebarHeader>

      {/* ── Content: Channels or DMs ─────────────────────────────────── */}
      <SidebarContent>
        <Show
          when={selectedServerId()}
          fallback={
            /* ── Home: Friends + DMs ─────────────────────────────────── */
            <>
              <SidebarMenu class="pt-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      navigate("/home/friends");
                      props.onNavigate?.();
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
                    Friends
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>

              <div class="mx-3 my-2 h-px bg-border" />

              <Show
                when={(readyData.data?.dmChannels ?? []).length > 0}
                fallback={
                  <p class="px-4 py-3 text-xs text-muted-foreground">No conversations yet</p>
                }
              >
                <SidebarMenu>
                  <For each={readyData.data?.dmChannels}>
                    {(dm) => {
                      const displayName = () =>
                        dm.otherUser.displayName ?? dm.otherUser.username ?? "Unknown";
                      const initial = () => displayName().charAt(0).toUpperCase();
                      const isActive = () => selectedDmChannelId() === dm.id;

                      return (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            active={isActive()}
                            onClick={() => {
                              selectDmChannel(dm.id);
                              props.onNavigate?.();
                            }}
                          >
                            <div class="relative shrink-0">
                              <Show
                                when={dm.otherUser.avatarUrl}
                                fallback={
                                  <div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                                    {initial()}
                                  </div>
                                }
                              >
                                {(url) => (
                                  <img src={url()} alt={displayName()} class="h-6 w-6 rounded-full object-cover" />
                                )}
                              </Show>
                              <StatusDot
                                status={dm.otherUser.status as UserStatus}
                                size="sm"
                                borderClass="border-sidebar"
                              />
                            </div>
                            <span class="truncate">{displayName()}</span>
                            <Show when={!isActive() && getUnreadCount(dm.id) > 0}>
                              <span class="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                                {getUnreadCount(dm.id)}
                              </span>
                            </Show>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }}
                  </For>
                </SidebarMenu>
                <Show when={readyData.data?.hasMoreDmChannels}>
                  <button
                    class="mx-3 mt-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    disabled={loadingMoreDms()}
                    onClick={() => fetchMoreDms()}
                  >
                    {loadingMoreDms() ? "Loading..." : "Load more"}
                  </button>
                </Show>
              </Show>
            </>
          }
        >
          {/* ── Server: Channels ─────────────────────────────────────── */}
          <SidebarGroup label="Channels" actions={channelActions()} collapsible defaultOpen>
            <Show
              when={channelCacheLoading() !== selectedServerId()}
              fallback={<p class="px-4 py-3 text-xs text-muted-foreground">Loading channels...</p>}
            >
              <SidebarMenu>
                <For each={currentChannels()}>
                  {(channel) => {
                    const isActive = () => selectedChannelId() === channel.id;
                    return (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          active={isActive()}
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            props.onNavigate?.();
                          }}
                        >
                          <span class="text-muted-foreground">#</span>
                          <span class="truncate">{channel.name}</span>
                          <Show when={(!isActive() && getUnreadCount(channel.id) > 0) || channel.fileSharingEnabled}>
                            <span class="ml-auto flex shrink-0 items-center gap-1.5">
                              <Show when={!isActive() && getUnreadCount(channel.id) > 0}>
                                <span class="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
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
          </SidebarGroup>
        </Show>
      </SidebarContent>

      {/* ── Footer: User Panel ───────────────────────────────────────── */}
      <SidebarFooter>
        {/* PWA install button added in feat/pwa-admin-infra PR */}
        <div class="relative flex min-w-0 flex-1 items-center gap-2">
          <Show
            when={readyData.data?.user.avatarUrl}
            fallback={
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {session()?.data?.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
            }
          >
            {(url) => (
              <img src={url()} alt={session()?.data?.user?.name ?? "User"} class="h-8 w-8 shrink-0 rounded-full object-cover" />
            )}
          </Show>
          <div class="min-w-0 flex-1">
            <Show
              when={readyData.data?.user.displayName}
              fallback={
                <span
                  class="block truncate text-sm font-medium text-foreground cursor-pointer"
                  role="button"
                  title="Copy username"
                  onClick={async () => {
                    const username = readyData.data?.user.username ?? session()?.data?.user?.name ?? "User";
                    try {
                      await navigator.clipboard.writeText(username);
                      setCopiedUsername(true);
                      setTimeout(() => setCopiedUsername(false), 1500);
                    } catch { /* clipboard unavailable */ }
                  }}
                >
                  {copiedUsername()
                    ? "Copied!"
                    : (readyData.data?.user.username ?? session()?.data?.user?.name ?? "User")}
                </span>
              }
            >
              {(dn) => (
                <>
                  <div class="truncate text-sm font-medium text-foreground">{dn()}</div>
                  <span
                    class="block truncate text-xs text-muted-foreground cursor-pointer"
                    role="button"
                    title="Copy username"
                    onClick={async () => {
                      const username = readyData.data?.user.username ?? session()?.data?.user?.name ?? "User";
                      try {
                        await navigator.clipboard.writeText(username);
                        setCopiedUsername(true);
                        setTimeout(() => setCopiedUsername(false), 1500);
                      } catch { /* clipboard unavailable */ }
                    }}
                  >
                    {copiedUsername()
                      ? "Copied!"
                      : (readyData.data?.user.username ?? session()?.data?.user?.name ?? "User")}
                  </span>
                </>
              )}
            </Show>
          </div>
          <Show
            when={isPaidUser()}
            fallback={
              <button
                onClick={() => setShowPricingModal(true)}
                class="rounded p-1.5 text-primary transition-colors hover:bg-accent hover:text-primary"
                title="Upgrade"
                aria-label="Upgrade"
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
              </button>
            }
          >
            <button
              onClick={() => setShowSubscriptionModal(true)}
              class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Manage Subscription"
              aria-label="Manage Subscription"
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </button>
          </Show>
          <button
            type="button"
            onClick={() => {
              selectHome();
              navigate("/home/settings");
            }}
            class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Settings"
            aria-label="Settings"
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
          <button
            onClick={handleLogout}
            class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
            title="Log out"
            aria-label="Log out"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </SidebarFooter>

      {/* ── Modals ───────────────────────────────────────────────────── */}
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
    </Sidebar>
  );
};

export default AppSidebar;
