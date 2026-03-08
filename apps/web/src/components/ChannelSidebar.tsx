import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSession, signOut } from "../lib/auth.js";
import {
  currentServer,
  currentChannels,
  selectedChannelId,
  setSelectedChannelId,
} from "../stores/app-store.js";
import InviteModal from "./modals/InviteModal.js";

const ChannelSidebar = () => {
  const session = useSession();
  const navigate = useNavigate();
  const [showInvite, setShowInvite] = createSignal(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div class="flex h-full w-60 shrink-0 flex-col bg-bg-secondary">
      {/* Server name header */}
      <div class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span class="truncate font-semibold text-text-primary">
          {currentServer()?.name ?? "UnCorded"}
        </span>
        <Show when={currentServer()}>
          <button
            onClick={() => setShowInvite(true)}
            title="Invite People"
            class="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
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
        </Show>
      </div>

      {/* Channel list */}
      <div class="flex-1 overflow-y-auto p-2">
        <div class="px-2 pt-4 text-xs font-semibold uppercase text-text-muted">Channels</div>
        <For each={currentChannels()}>
          {(channel) => {
            const isActive = () => selectedChannelId() === channel.id;
            return (
              <button
                onClick={() => setSelectedChannelId(channel.id)}
                class="mt-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors"
                classList={{
                  "bg-bg-active text-text-primary": isActive(),
                  "text-text-secondary hover:bg-bg-hover hover:text-text-primary": !isActive(),
                }}
              >
                <span class="truncate">
                  <span class="text-text-muted">#</span> {channel.name}
                </span>
                <Show when={channel.fileSharingEnabled}>
                  <span
                    class="ml-auto h-2 w-2 shrink-0 rounded-full bg-success"
                    title="File sharing enabled"
                  />
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* User panel */}
      <div class="flex shrink-0 items-center gap-2 border-t border-border bg-bg-primary/50 px-2 py-2">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {session()?.data?.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-text-primary">
            {session()?.data?.user?.username ?? session()?.data?.user?.name ?? "User"}
          </div>
          <div class="flex items-center gap-1">
            <div class="h-2 w-2 rounded-full bg-success" />
            <span class="text-xs text-text-muted">Online</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          class="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-danger"
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

      {/* Invite modal */}
      <Show when={showInvite() && currentServer()}>
        {(server) => <InviteModal serverId={server().id} onClose={() => setShowInvite(false)} />}
      </Show>
    </div>
  );
};

export default ChannelSidebar;
