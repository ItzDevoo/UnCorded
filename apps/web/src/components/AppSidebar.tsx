import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession, signOut } from "../lib/auth.js";
import { readyData } from "../lib/gateway-store.js";
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

const iconBtnClass =
  "rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

const AppSidebar = () => {
  const session = useSession();
  const navigate = useNavigate();
  const [modal, setModal] = createSignal<"create" | "join" | "invite" | "create-channel" | null>(
    null,
  );

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
          <div class="flex min-w-0 flex-1 items-center justify-center gap-1.5">
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
                  <SidebarMenuButton onClick={() => navigate("/app/friends")}>
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
                      const isOnline = () => dm.otherUser.status === "online";
                      const isActive = () => selectedDmChannelId() === dm.id;

                      return (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            active={isActive()}
                            onClick={() => selectDmChannel(dm.id)}
                          >
                            <div class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {initial()}
                              <Show when={isOnline()}>
                                <div class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-success" />
                              </Show>
                            </div>
                            <span class="truncate">{displayName()}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }}
                  </For>
                </SidebarMenu>
              </Show>
            </>
          }
        >
          {/* ── Server: Channels ─────────────────────────────────────── */}
          <SidebarGroup label="Channels" actions={channelActions()} collapsible defaultOpen>
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
          </SidebarGroup>
        </Show>
      </SidebarContent>

      {/* ── Footer: User Panel ───────────────────────────────────────── */}
      <SidebarFooter>
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {session()?.data?.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-foreground">
              {session()?.data?.user?.username ?? session()?.data?.user?.name ?? "User"}
            </div>
            <div class="flex items-center gap-1">
              <div class="h-2 w-2 rounded-full bg-success" />
              <span class="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
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

export default AppSidebar;
