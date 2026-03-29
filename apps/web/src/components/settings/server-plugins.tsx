import { createSignal, createResource, For, Show } from "solid-js";
import type { ServerId, PluginId } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";
import { readyData } from "../../lib/gateway-store.js";
import { isDesktop } from "../../stores/plugin-store.js";

interface ServerPluginsProps {
  serverId: ServerId;
}

interface ServerPlugin {
  id: string;
  pluginId: PluginId;
  state: "active" | "stopped" | "error";
  tunnelUrl: string | null;
  installedBy: string;
  installedAt: string;
  config: Record<string, unknown>;
}

interface CatalogPlugin {
  id: PluginId;
  name: string;
  description: string;
  author: string;
  icon: string | null;
  category: string;
  scope: "server" | "personal" | "both";
  tags: string[];
  installCount: number;
  installed: boolean;
}

const ServerPluginsTab = (props: ServerPluginsProps) => {
  const [installing, setInstalling] = createSignal<PluginId | null>(null);
  const [uninstalling, setUninstalling] = createSignal<PluginId | null>(null);

  const isServerOwnerTier = () =>
    readyData.data?.user.subscriptionTier === "server_owner";

  // Fetch installed server plugins
  const [installed, { refetch: refetchInstalled, mutate: mutateInstalled }] = createResource(
    () => props.serverId,
    async (serverId) => {
      const res = await api<{ plugins: ServerPlugin[] }>(
        `/api/servers/${serverId}/plugins`,
      );
      return res.plugins;
    },
  );

  // Fetch catalog (filtered to server/both scope)
  const [catalog] = createResource(async () => {
    const res = await api<{ plugins: CatalogPlugin[] }>("/api/plugins");
    return res.plugins.filter(
      (p) => p.scope === "server" || p.scope === "both",
    );
  });

  const installedPluginIds = () =>
    new Set((installed() ?? []).map((p) => p.pluginId));

  const availablePlugins = () =>
    (catalog() ?? []).filter((p) => !installedPluginIds().has(p.id));

  async function handleInstall(pluginId: PluginId) {
    if (installing()) return;
    setInstalling(pluginId);
    try {
      await api(`/api/servers/${props.serverId}/plugins`, {
        method: "POST",
        body: JSON.stringify({ pluginId }),
      });
      showToast("Server plugin installed", "info");
      await refetchInstalled();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.body.message
          : "Failed to install plugin";
      showToast(msg, "error");
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(pluginId: PluginId) {
    if (uninstalling()) return;
    setUninstalling(pluginId);
    try {
      await api(`/api/servers/${props.serverId}/plugins/${pluginId}`, {
        method: "DELETE",
      });
      mutateInstalled((prev) => prev?.filter((p) => p.pluginId !== pluginId));
      showToast("Server plugin uninstalled", "info");
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.body.message
          : "Failed to uninstall plugin";
      showToast(msg, "error");
    } finally {
      setUninstalling(null);
    }
  }

  const stateLabel = (state: string) => {
    switch (state) {
      case "active":
        return "Running";
      case "stopped":
        return "Stopped";
      case "error":
        return "Error";
      default:
        return state;
    }
  };

  const stateColor = (state: string) => {
    switch (state) {
      case "active":
        return "bg-success";
      case "stopped":
        return "bg-muted-foreground";
      case "error":
        return "bg-destructive";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Server Plugins</h2>
        <p class="text-sm text-muted-foreground">
          Manage plugins that run for all members of this server.
        </p>
      </div>

      {/* Tier gate */}
      <Show when={!isServerOwnerTier()}>
        <div class="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <p class="text-sm font-medium text-foreground">Server Owner tier required</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Upgrade to the Server Owner plan to install and manage server plugins.
          </p>
        </div>
      </Show>

      {/* Installed plugins */}
      <Show when={!installed.loading} fallback={
        <div class="h-20 animate-skeleton rounded-xl border border-border bg-muted" />
      }>
        <Show when={(installed() ?? []).length > 0}>
          <div class="space-y-3">
            <h3 class="text-sm font-medium text-muted-foreground">Installed</h3>
            <For each={installed()}>
              {(plugin) => (
                <div class="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div class="flex items-center gap-3">
                    <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                      </svg>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-foreground">{plugin.pluginId}</span>
                        <span class="flex items-center gap-1 text-xs text-muted-foreground">
                          <span class={`inline-block h-1.5 w-1.5 rounded-full ${stateColor(plugin.state)}`} />
                          {stateLabel(plugin.state)}
                        </span>
                      </div>
                      <Show when={plugin.tunnelUrl}>
                        <p class="mt-0.5 text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                          {plugin.tunnelUrl}
                        </p>
                      </Show>
                    </div>
                  </div>
                  <Show when={isServerOwnerTier()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUninstall(plugin.pluginId)}
                      disabled={uninstalling() === plugin.pluginId}
                    >
                      {uninstalling() === plugin.pluginId ? "Removing..." : "Uninstall"}
                    </Button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Available plugins */}
      <Show when={isServerOwnerTier() && availablePlugins().length > 0}>
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-muted-foreground">Available</h3>
          <For each={availablePlugins()}>
            {(plugin) => (
              <div class="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-foreground">{plugin.name}</span>
                    <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {plugin.scope === "both" ? "Server + Personal" : "Server"}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-muted-foreground">{plugin.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInstall(plugin.id)}
                  disabled={installing() === plugin.id}
                >
                  {installing() === plugin.id ? "Installing..." : "Install for Server"}
                </Button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Desktop hint */}
      <Show when={!isDesktop() && isServerOwnerTier()}>
        <div class="rounded-lg border border-border bg-muted/50 p-4">
          <p class="text-sm text-muted-foreground">
            Server plugins run on the desktop app. Install them here, then start them from
            the desktop client.
          </p>
        </div>
      </Show>
    </div>
  );
};

export default ServerPluginsTab;
