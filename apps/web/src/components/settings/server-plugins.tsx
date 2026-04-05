import {
  createSignal,
  createEffect,
  createResource,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import type { ServerId, PluginId, UserId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../ui/button.js";
import { PluginCard, type PluginCardData } from "../ui/plugin-card.js";
import { readyData } from "../../lib/gateway-store.js";
import { isDesktop } from "../../stores/plugin-store.js";
import type { PluginUpdateInfo } from "../../types/desktop-bridge.js";

interface ServerPluginsProps {
  serverId: ServerId;
}

interface ServerPlugin {
  id: string;
  pluginId: PluginId;
  state: "active" | "stopped" | "error";
  tunnelUrl: string | null;
  installedBy: UserId;
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
  version: string;
  verified: boolean;
  featured: boolean;
  downloads: number;
  installCount: number;
  installed: boolean;
}

function catalogToCardData(p: CatalogPlugin): PluginCardData {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    author: p.author,
    icon: p.icon,
    category: p.category,
    scope: p.scope as "server" | "personal" | "both",
    tags: p.tags,
    version: p.version,
    verified: p.verified,
    featured: p.featured,
    downloads: p.downloads,
    installCount: p.installCount,
  };
}

function stateStatus(state: string): { label: string; color: string } {
  switch (state) {
    case "active":
      return { label: "Running", color: "bg-success" };
    case "stopped":
      return { label: "Stopped", color: "bg-muted-foreground" };
    case "error":
      return { label: "Error", color: "bg-destructive" };
    default:
      return { label: state, color: "bg-muted-foreground" };
  }
}

const ServerPluginsTab = (props: ServerPluginsProps) => {
  const [installing, setInstalling] = createSignal<PluginId | null>(null);
  const [uninstalling, setUninstalling] = createSignal<PluginId | null>(null);
  const [toggling, setToggling] = createSignal<PluginId | null>(null);
  const [updating, setUpdating] = createSignal<PluginId | null>(null);
  const [search, setSearch] = createSignal("");
  const [pluginUpdates, setPluginUpdates] = createSignal<PluginUpdateInfo[]>([]);

  // Cloudflare tunnel configuration (desktop only)
  const [cfConfigured, setCfConfigured] = createSignal(false);
  const [cfLoading, setCfLoading] = createSignal(false);
  const [cfToken, setCfToken] = createSignal("");
  const [cfAccountId, setCfAccountId] = createSignal("");
  const [cfError, setCfError] = createSignal("");
  const [cfExpanded, setCfExpanded] = createSignal(false);

  createEffect(() => {
    if (!isDesktop()) return;
    let attempts = 0;
    const maxAttempts = 5;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const probe = () => {
      if (disposed) return;
      window
        .desktopBridge!.cloudflare.getStatus()
        .then((s) => {
          if (disposed) return;
          if (s.configured) {
            setCfConfigured(true);
          } else if (++attempts < maxAttempts) {
            retryTimer = setTimeout(probe, 2000);
          } else {
            setCfConfigured(false);
          }
        })
        .catch(() => {
          if (disposed) return;
          if (++attempts < maxAttempts) {
            retryTimer = setTimeout(probe, 2000);
          }
        });
    };
    probe();

    const unsub = window.desktopBridge!.onSidecarReady(() => {
      if (disposed) return;
      clearTimeout(retryTimer);
      attempts = 0;
      probe();
    });
    onCleanup(() => {
      disposed = true;
      clearTimeout(retryTimer);
      unsub();
    });
  });

  const handleCfSave = async () => {
    setCfLoading(true);
    setCfError("");
    try {
      const result = await window.desktopBridge!.cloudflare.configure(cfToken(), cfAccountId());
      if (result.success) {
        setCfConfigured(true);
        setCfToken("");
        setCfAccountId("");
        setCfExpanded(false);
      } else {
        setCfError(result.error ?? "Failed to configure");
      }
    } catch (err) {
      setCfError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCfLoading(false);
    }
  };

  const handleCfClear = async () => {
    if (
      !window.confirm("Remove Cloudflare credentials? Plugins will fall back to temporary tunnels.")
    )
      return;
    try {
      const result = await window.desktopBridge!.cloudflare.clear();
      if (result.success) {
        setCfConfigured(false);
        setCfError("");
      } else {
        setCfError(result.error ?? "Failed to clear Cloudflare credentials");
      }
    } catch (err) {
      setCfError(err instanceof Error ? err.message : "Failed to clear credentials");
    }
  };

  onMount(() => {
    if (!isDesktop()) return;
    const bridge = window.desktopBridge;
    if (!bridge?.plugins?.onUpdatesAvailable) return;
    const unsub = bridge.plugins.onUpdatesAvailable((updates) => setPluginUpdates(updates));
    onCleanup(unsub);
  });

  const isServerOwnerTier = () => readyData.data?.user.subscriptionTier === "server_owner";

  const [installed, { refetch: refetchInstalled, mutate: mutateInstalled }] = createResource(
    () => props.serverId,
    async (serverId) => {
      const res = await api<{ plugins: ServerPlugin[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/plugins`,
      );
      return res.plugins;
    },
  );

  const [catalog] = createResource(async () => {
    const res = await api<{ plugins: CatalogPlugin[] }>("/api/plugins");
    return res.plugins.filter((p) => p.scope === "server" || p.scope === "both");
  });

  const catalogMap = () => {
    const map = new Map<string, CatalogPlugin>();
    for (const p of catalog() ?? []) map.set(p.id, p);
    return map;
  };

  const installedPluginIds = () => new Set((installed() ?? []).map((p) => p.pluginId));

  const availablePlugins = () => {
    let list = (catalog() ?? []).filter((p) => !installedPluginIds().has(p.id));
    const q = search().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list.toSorted((a, b) => (a.featured !== b.featured ? (a.featured ? -1 : 1) : 0));
  };

  function installedToCardData(sp: ServerPlugin): PluginCardData {
    const cat = catalogMap().get(sp.pluginId);
    return {
      id: sp.pluginId,
      name:
        cat?.name ??
        sp.pluginId
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      description: cat?.description ?? "",
      author: cat?.author ?? "Unknown",
      icon: cat?.icon ?? null,
      category: cat?.category ?? "Other",
      scope: (cat?.scope ?? "server") as "server" | "personal" | "both",
      tags: cat?.tags ?? [],
      version: cat?.version ?? "1.0.0",
      verified: cat?.verified ?? false,
      featured: cat?.featured ?? false,
      downloads: cat?.downloads ?? 0,
      installCount: cat?.installCount ?? 0,
    };
  }

  async function handleInstall(pluginId: PluginId) {
    if (installing()) return;
    setInstalling(pluginId);
    try {
      await api(`/api/servers/${encodeURIComponent(props.serverId)}/plugins`, {
        method: "POST",
        body: JSON.stringify({ pluginId }),
      });
      showToast("Server plugin installed", "info");
      await refetchInstalled();
    } catch (err) {
      handleApiError(err, "Failed to install plugin");
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(pluginId: PluginId) {
    if (uninstalling()) return;
    setUninstalling(pluginId);
    try {
      if (isDesktop()) {
        try {
          await window.desktopBridge!.plugins.uninstall(pluginId);
        } catch {
          /* continue */
        }
      }
      await api(
        `/api/servers/${encodeURIComponent(props.serverId)}/plugins/${encodeURIComponent(pluginId)}`,
        {
          method: "DELETE",
        },
      );
      mutateInstalled((prev) => prev?.filter((p) => p.pluginId !== pluginId));
      showToast("Server plugin uninstalled", "info");
    } catch (err) {
      handleApiError(err, "Failed to uninstall plugin");
    } finally {
      setUninstalling(null);
    }
  }

  async function handleToggle(pluginId: PluginId, currentState: string) {
    if (toggling()) return;
    if (!isDesktop()) {
      showToast("Start/Stop requires the desktop app", "error");
      return;
    }
    setToggling(pluginId);
    try {
      const isRunning = currentState === "active";
      if (isRunning) {
        await window.desktopBridge!.plugins.stop(pluginId);
        showToast("Plugin stopped", "info");
      } else {
        await window.desktopBridge!.plugins.start(pluginId, props.serverId);
        showToast("Plugin started", "info");
      }
      await refetchInstalled();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ECONNREFUSED|no such container|docker/i.test(msg)) {
        showToast("Docker Desktop is required to run plugins.", "error", {
          durationMs: 10_000,
          subtitle: "Click to download Docker Desktop",
          onClick: () => window.open("https://www.docker.com/products/docker-desktop/", "_blank"),
        });
      } else {
        handleApiError(err, "Failed to toggle plugin");
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleUpdate(pluginId: PluginId) {
    if (!isDesktop()) return;
    setUpdating(pluginId);
    try {
      await window.desktopBridge!.plugins.update(pluginId);
      showToast("Plugin updated successfully", "info");
      setPluginUpdates((prev) => prev.filter((u) => u.pluginId !== pluginId));
      await refetchInstalled();
    } catch (err) {
      handleApiError(err, "Failed to update plugin");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Server Plugins</h2>
        <p class="text-sm text-muted-foreground">
          Manage plugins that run for all members of this server.
        </p>
      </div>

      {/* Desktop hint — shown first so users understand the constraint */}
      <Show when={!isDesktop()}>
        <div class="rounded-lg border border-border bg-muted/50 p-4">
          <p class="text-sm text-muted-foreground">
            Server plugins run on the desktop app. Install them here, then start them from the
            desktop client.
          </p>
        </div>
      </Show>

      {/* Tier gate */}
      <Show when={!isServerOwnerTier()}>
        <div class="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <p class="text-sm font-medium text-foreground">Server Owner tier required</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Upgrade to the Server Owner plan to install and manage server plugins.
          </p>
        </div>
      </Show>

      {/* Cloudflare tunnel configuration (desktop only) */}
      <Show when={isDesktop()}>
        <div class="rounded-lg border border-border p-4 mb-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-medium">Cloudflare Tunnels</h3>
              <Show when={cfConfigured()}>
                <span class="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">
                  Active
                </span>
              </Show>
            </div>
            <Show
              when={cfConfigured()}
              fallback={
                <button
                  class="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCfExpanded(!cfExpanded())}
                >
                  {cfExpanded() ? "Cancel" : "Configure"}
                </button>
              }
            >
              <button
                class="text-xs text-destructive hover:text-destructive/80"
                onClick={handleCfClear}
              >
                Remove
              </button>
            </Show>
          </div>
          <Show when={cfError()}>
            <p class="mt-1 text-xs text-destructive">{cfError()}</p>
          </Show>
          <p class="mt-1 text-xs text-muted-foreground">
            Named tunnels provide stable URLs for your server plugins. Without this, plugins use
            temporary random URLs.
          </p>

          <Show when={cfExpanded() && !cfConfigured()}>
            <div class="mt-3 space-y-2">
              <label for="cf-account-id" class="sr-only">
                Cloudflare Account ID
              </label>
              <input
                id="cf-account-id"
                type="text"
                placeholder="Cloudflare Account ID"
                value={cfAccountId()}
                onInput={(e) => setCfAccountId(e.currentTarget.value)}
                class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <label for="cf-api-token" class="sr-only">
                API Token
              </label>
              <input
                id="cf-api-token"
                type="password"
                placeholder="API Token"
                value={cfToken()}
                onInput={(e) => setCfToken(e.currentTarget.value)}
                class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <div class="flex items-center gap-2">
                <button
                  class="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
                  onClick={handleCfSave}
                  disabled={cfLoading() || !cfToken() || !cfAccountId()}
                >
                  {cfLoading() ? "Validating..." : "Save"}
                </button>
                <a
                  href="https://developers.cloudflare.com/fundamentals/api/get-started/create-token/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  How to create an API token
                </a>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Installed plugins */}
      <Show
        when={!installed.loading}
        fallback={<div class="h-20 animate-skeleton rounded-xl border border-border bg-muted" />}
      >
        <Show when={(installed() ?? []).length > 0}>
          <div class="space-y-3">
            <h3 class="text-sm font-medium text-muted-foreground">Installed</h3>
            <For each={installed()}>
              {(plugin) => (
                <PluginCard
                  plugin={installedToCardData(plugin)}
                  status={stateStatus(plugin.state)}
                  badge={
                    <Show when={pluginUpdates().find((u) => u.pluginId === plugin.pluginId)}>
                      {(update) => (
                        <span class="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                          v{update().availableVersion} available
                        </span>
                      )}
                    </Show>
                  }
                  actions={
                    <Show when={isServerOwnerTier()}>
                      <div class="flex gap-2">
                        <Show when={pluginUpdates().find((u) => u.pluginId === plugin.pluginId)}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdate(plugin.pluginId)}
                            disabled={updating() === plugin.pluginId}
                          >
                            {updating() === plugin.pluginId ? "Updating..." : "Update"}
                          </Button>
                        </Show>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(plugin.pluginId, plugin.state)}
                          disabled={toggling() === plugin.pluginId || !isDesktop()}
                          title={!isDesktop() ? "Requires desktop app" : undefined}
                        >
                          {toggling() === plugin.pluginId
                            ? "..."
                            : plugin.state === "active"
                              ? "Stop"
                              : "Start"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUninstall(plugin.pluginId)}
                          disabled={uninstalling() === plugin.pluginId}
                        >
                          {uninstalling() === plugin.pluginId ? "Removing..." : "Uninstall"}
                        </Button>
                      </div>
                    </Show>
                  }
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Empty state */}
      <Show
        when={
          !installed.loading && (installed() ?? []).length === 0 && availablePlugins().length === 0
        }
      >
        <div class="rounded-lg border border-border p-6 text-center">
          <p class="text-sm text-muted-foreground">
            No server plugins available yet. Check back soon!
          </p>
        </div>
      </Show>

      {/* Available plugins */}
      <Show when={availablePlugins().length > 0}>
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-muted-foreground">Available</h3>

          {/* Search */}
          <div class="relative">
            <svg
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search plugins..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="w-full rounded-lg border border-border bg-input py-2 pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-shadow duration-200 focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <For each={availablePlugins()}>
            {(plugin) => (
              <PluginCard
                plugin={catalogToCardData(plugin)}
                actions={
                  <Button
                    size="sm"
                    onClick={() => handleInstall(plugin.id)}
                    disabled={installing() === plugin.id || !isServerOwnerTier()}
                    title={!isServerOwnerTier() ? "Server Owner tier required" : undefined}
                  >
                    {installing() === plugin.id ? "Installing..." : "Install for Server"}
                  </Button>
                }
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ServerPluginsTab;
