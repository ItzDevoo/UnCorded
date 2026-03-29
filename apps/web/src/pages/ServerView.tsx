import { createEffect, lazy, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import type { ServerId } from "@uncorded/protocol";
import { readyData, channelCache, channelCacheLoading } from "../lib/gateway-store.js";
import {
  selectedServerId,
  setSelectedServerId,
  selectedChannelId,
  setSelectedChannelId,
} from "../stores/app-store.js";
import { activePlugin, activeServerPlugin, type PluginInfo } from "../stores/plugin-store.js";
import ChatArea from "../components/ChatArea.js";
import { Empty } from "../components/ui/empty.js";
import ContentHeader from "../components/ContentHeader.js";

const PluginFrame = lazy(() => import("../components/PluginFrame.js"));

const ServerView = () => {
  const params = useParams<{ serverId: string }>();
  const navigate = useNavigate();

  const serverId = () => params.serverId as ServerId;

  // Auto-select server from URL param
  createEffect(() => {
    const id = serverId();
    if (id && selectedServerId() !== id) {
      setSelectedServerId(id);
    }
  });

  const hasServer = () =>
    readyData.data?.servers.some((s) => s.id === serverId()) ?? false;

  const isLoadingChannels = () =>
    channelCacheLoading() === serverId();

  const serverName = () =>
    readyData.data?.servers.find((s) => s.id === serverId())?.name ?? "Server";

  const serverChannels = () => channelCache[serverId()] ?? [];

  // Auto-select first channel if server has channels but no valid selection
  createEffect(() => {
    if (hasServer() && !isLoadingChannels()) {
      const channels = serverChannels();
      const currentChannelId = selectedChannelId();
      const isValidChannel = currentChannelId && channels.some((c) => c.id === currentChannelId);

      const first = channels[0];
      if (first && !isValidChannel) {
        setSelectedChannelId(first.id);
      }
    }
  });

  const hasValidChannel = () => {
    const currentChannelId = selectedChannelId();
    return currentChannelId && serverChannels().some((c) => c.id === currentChannelId);
  };

  // Map a server plugin to the PluginInfo shape PluginFrame expects
  const serverPluginAsInfo = (): PluginInfo | null => {
    const sp = activeServerPlugin();
    if (!sp) return null;
    return {
      id: sp.pluginId,
      name: sp.pluginId.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      icon: null,
      uiSlot: "content",
      header: false,
      rightPanel: false,
      status: sp.state === "active" ? "running" : sp.state === "error" ? "crashed" : "stopped",
      port: 0,
      scope: "server",
      tunnelUrl: sp.tunnelUrl,
      permissions: [],
    };
  };

  const currentPlugin = () => activePlugin() ?? serverPluginAsInfo();

  return (
    <div class="flex h-full flex-col">
      {/* Plugin takes over the entire content area when active */}
      <Show
        when={currentPlugin()}
        fallback={
          <>
            <ContentHeader
              title={serverName()}
              breadcrumbs={[{ label: "Servers" }]}
            />
            <Show
              when={hasServer() && hasValidChannel()}
              fallback={
                <Show
                  when={hasServer()}
                  fallback={
                    <Empty
                      title="Server not found"
                      description="You may not be a member of this server."
                    >
                      <button
                        type="button"
                        onClick={() => navigate("/home")}
                        class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        &larr; Back to Home
                      </button>
                    </Empty>
                  }
                >
                  <Show
                    when={!isLoadingChannels()}
                    fallback={
                      <div class="flex flex-1 items-center justify-center">
                        <div class="flex animate-fade-in flex-col items-center gap-3">
                          <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <p class="text-muted-foreground">Loading channels...</p>
                        </div>
                      </div>
                    }
                  >
                    <Empty
                      title="No channels"
                      description="This server has no channels yet."
                    />
                  </Show>
                </Show>
              }
            >
              <ChatArea />
            </Show>
          </>
        }
      >
        {(plugin) => (
          <>
            <ContentHeader
              title={plugin().name}
              breadcrumbs={[{ label: "Servers" }]}
            />
            <div class="flex-1 overflow-hidden">
              <PluginFrame plugin={plugin()} tunnelUrl={activeServerPlugin()?.tunnelUrl ?? null} />
            </div>
          </>
        )}
      </Show>
    </div>
  );
};

export default ServerView;
