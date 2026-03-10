import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession, signOut } from "../lib/auth.js";
import { readyData } from "../lib/gateway-store.js";
import {
  selectedServerId,
  selectedChannelId,
  setSelectedChannelId,
  selectedDmChannelId,
  selectDmChannel,
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
import JoinServerModal from "./modals/JoinServerModal.js";
import InviteModal from "./modals/InviteModal.js";

const AppSidebar = () => {
  const session = useSession();
  const navigate = useNavigate();
  const [modal, setModal] = createSignal<"create" | "join" | "invite" | null>(null);

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar>
      {/* ── Header: Server Switcher ──────────────────────────────────── */}
      <SidebarHeader>
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

              <SidebarGroup label="Direct Messages" collapsible defaultOpen>
                <Show
                  when={(readyData.data?.dmChannels ?? []).length > 0}
                  fallback={
                    <p class="px-4 py-2 text-xs text-muted-foreground">No conversations yet</p>
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
              </SidebarGroup>
            </>
          }
        >
          {/* ── Server: Channels ─────────────────────────────────────── */}
          <SidebarGroup label="Channels" collapsible defaultOpen>
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

          {/* Invite action in the group header area */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                class="text-muted-foreground"
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
                Invite People
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
          <button
            onClick={handleLogout}
            class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
            title="Log out"
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
    </Sidebar>
  );
};

export default AppSidebar;
