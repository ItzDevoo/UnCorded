import { createSignal, lazy, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { readyData } from "../lib/gateway-store.js";
import { selectedServerId, currentServer } from "../stores/app-store.js";

const OverviewTab = lazy(() => import("../components/settings/server-overview.js"));
const ChannelsTab = lazy(() => import("../components/settings/channel-management.js"));
const MembersTab = lazy(() => import("../components/settings/member-management.js"));
const InvitesTab = lazy(() => import("../components/settings/invite-management.js"));
const PluginsTab = lazy(() => import("../components/settings/server-plugins.js"));

type Tab = "overview" | "channels" | "members" | "invites" | "plugins";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "channels", label: "Channels" },
  { id: "members", label: "Members" },
  { id: "invites", label: "Invites" },
  { id: "plugins", label: "Plugins" },
];

const ServerSettings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<Tab>("overview");

  const server = () => currentServer();
  const serverId = () => selectedServerId();
  const isOwner = () => server()?.ownerId === readyData.data?.user.id;

  return (
    <Show
      when={server() && serverId() && isOwner()}
      fallback={
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <p class="text-muted-foreground">You don't have access to server settings.</p>
            <button
              type="button"
              class="mt-3 text-sm text-primary hover:underline"
              onClick={() => navigate("/home")}
            >
              Go back
            </button>
          </div>
        </div>
      }
    >
      <div class="flex h-full flex-col">
        {/* Header */}
        <div class="flex items-center gap-3 border-b border-border px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/home")}
            class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Back"
            aria-label="Back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-lg font-semibold text-foreground">Server Settings</h1>
          <span class="text-sm text-muted-foreground">— {server()?.name}</span>
        </div>

        {/* Tab bar */}
        <div class="flex gap-1 border-b border-border px-6">
          {tabs.map((tab) => (
            <button
              type="button"
              class={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab() === tab.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-y-auto p-6">
          <div class="mx-auto max-w-2xl">
            <Show when={activeTab() === "overview"}>
              <OverviewTab
                serverId={serverId()!}
                serverName={server()!.name}
                serverIconUrl={server()!.iconUrl}
              />
            </Show>
            <Show when={activeTab() === "channels"}>
              <ChannelsTab serverId={serverId()!} />
            </Show>
            <Show when={activeTab() === "members"}>
              <MembersTab serverId={serverId()!} ownerId={server()!.ownerId} />
            </Show>
            <Show when={activeTab() === "invites"}>
              <InvitesTab serverId={serverId()!} />
            </Show>
            <Show when={activeTab() === "plugins"}>
              <PluginsTab serverId={serverId()!} />
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ServerSettings;
