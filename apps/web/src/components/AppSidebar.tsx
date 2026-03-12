import { createSignal, For, Show, onCleanup } from "solid-js";
import { Opcode } from "@uncorded/protocol";
import { sendFrame } from "../lib/gateway.js";
import { useNavigate } from "@solidjs/router";
import { useSession, signOut } from "../lib/auth.js";
import { readyData, channelCacheLoading, setUserStatus } from "../lib/gateway-store.js";
import { createCheckout, createPortalSession } from "../lib/api.js";
import { showToast } from "./ui/toast.js";
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
import StatusDot, { StatusDotInline, type UserStatus } from "./StatusDot.js";

const iconBtnClass =
  "rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

const AppSidebar = () => {
  const session = useSession();
  const navigate = useNavigate();
  const [modal, setModal] = createSignal<"create" | "join" | "invite" | "create-channel" | null>(
    null,
  );
  const [showStatusMenu, setShowStatusMenu] = createSignal(false);

  const isServerOwner = () =>
    currentServer()?.ownerId != null && currentServer()?.ownerId === readyData.data?.user.id;

  const isPaidUser = () =>
    readyData.data?.user.subscriptionTier !== undefined &&
    readyData.data?.user.subscriptionTier !== "free";

  const handleUpgrade = async () => {
    try {
      const url = await createCheckout("supporter");
      window.location.href = url;
    } catch {
      showToast("Failed to start checkout", "error");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const portalUrl = await createPortalSession();
      window.location.href = portalUrl;
    } catch {
      showToast("Failed to open subscription portal", "error");
    }
  };

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
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
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
                  <SidebarMenuButton onClick={() => navigate("/home/friends")}>
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
                            onClick={() => selectDmChannel(dm.id)}
                          >
                            <div class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {initial()}
                              <StatusDot
                                status={dm.otherUser.status as UserStatus}
                                size="sm"
                                borderClass="border-sidebar"
                              />
                            </div>
                            <span class="truncate">{displayName()}</span>
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
                          onClick={() => setSelectedChannelId(channel.id)}
                        >
                          <span class="text-muted-foreground">#</span>
                          <span class="truncate">{channel.name}</span>
                          <Show when={channel.fileSharingEnabled}>
                            <span
                              class="ml-auto h-2 w-2 shrink-0 rounded-full bg-success"
                              title="File sharing enabled"
                            />
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
        <div class="relative flex min-w-0 flex-1 items-center gap-2">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {session()?.data?.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            onClick={() => setShowStatusMenu((v) => !v)}
            title="Change status"
            aria-expanded={showStatusMenu()}
            aria-controls="status-menu"
          >
            <div class="truncate text-sm font-medium text-foreground">
              {session()?.data?.user?.username ?? session()?.data?.user?.name ?? "User"}
            </div>
            <div class="flex items-center gap-1">
              <StatusDotInline status={(readyData.data?.user.status ?? "offline") as UserStatus} />
              <span class="text-xs text-muted-foreground capitalize">
                {readyData.data?.user.status === "dnd"
                  ? "Do Not Disturb"
                  : (readyData.data?.user.status ?? "Offline")}
              </span>
            </div>
          </button>

          {/* Status selector dropdown */}
          <Show when={showStatusMenu()}>
            <StatusMenu
              currentStatus={(readyData.data?.user.status ?? "offline") as UserStatus}
              onSelect={(status) => {
                setShowStatusMenu(false);
                setUserStatus(status);
                sendFrame({
                  op: Opcode.PRESENCE_UPDATE,
                  d: { status },
                });
              }}
              onClose={() => setShowStatusMenu(false)}
            />
          </Show>
          <Show
            when={isPaidUser()}
            fallback={
              <button
                onClick={handleUpgrade}
                class="rounded p-1.5 text-primary transition-colors hover:bg-accent hover:text-primary"
                title="Upgrade to Supporter"
                aria-label="Upgrade to Supporter"
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
              onClick={handleManageSubscription}
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
    </Sidebar>
  );
};

// ── Status Menu ─────────────────────────────────────────────────────────────

const statusOptions = [
  { value: "online", label: "Online", color: "bg-success" },
  { value: "idle", label: "Idle", color: "bg-warning" },
  { value: "dnd", label: "Do Not Disturb", color: "bg-destructive" },
] as const;

type SelectableStatus = (typeof statusOptions)[number]["value"];

const StatusMenu = (props: {
  currentStatus: UserStatus;
  onSelect: (status: SelectableStatus) => void;
  onClose: () => void;
}) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let menuRef!: HTMLDivElement;

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Defer listener to avoid catching the click that opened the menu
  let disposed = false;
  setTimeout(() => {
    if (!disposed) document.addEventListener("click", handleClickOutside);
  }, 0);
  onCleanup(() => {
    disposed = true;
    document.removeEventListener("click", handleClickOutside);
  });

  return (
    <div
      id="status-menu"
      ref={menuRef}
      class="absolute bottom-full left-0 mb-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md"
    >
      <For each={statusOptions}>
        {(opt) => (
          <button
            type="button"
            class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent ${props.currentStatus === opt.value ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => props.onSelect(opt.value)}
          >
            <div class={`h-2.5 w-2.5 rounded-full ${opt.color}`} />
            <span>{opt.label}</span>
            <Show when={props.currentStatus === opt.value}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="ml-auto h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
};

export default AppSidebar;
