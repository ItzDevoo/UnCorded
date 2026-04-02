import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { PluginId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { showToast } from "../../components/ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../../components/ui/button.js";
import { PluginCard, type PluginCardData } from "../../components/ui/plugin-card.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface Plugin {
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
  repository: string | null;
  screenshots: string[];
  installCount: number;
  installed: boolean;
  installedAt: string | null;
}

function toCardData(p: Plugin): PluginCardData {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    author: p.author,
    icon: p.icon,
    category: p.category,
    scope: p.scope,
    tags: p.tags,
    version: p.version,
    verified: p.verified,
    featured: p.featured,
    downloads: p.downloads,
    installCount: p.installCount,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const PluginsSettings = () => {
  const [search, setSearch] = createSignal("");
  const [categoryFilter, setCategoryFilter] = createSignal("all");
  const [scopeFilter, setScopeFilter] = createSignal("all");
  const [installing, setInstalling] = createSignal<PluginId | null>(null);

  const [plugins, { refetch, mutate }] = createResource(async () => {
    const res = await api<{ plugins: Plugin[] }>("/api/plugins");
    return res.plugins;
  });

  const categories = () => {
    const cats = new Set((plugins() ?? []).map((p) => p.category));
    return [...cats].toSorted();
  };

  // Only show personal/both scope plugins in user settings
  const personalPlugins = () =>
    (plugins() ?? []).filter((p) => p.scope === "personal" || p.scope === "both");

  const filteredPlugins = () => {
    let list = personalPlugins();

    const cat = categoryFilter();
    if (cat !== "all") list = list.filter((p) => p.category === cat);

    const scope = scopeFilter();
    if (scope !== "all") list = list.filter((p) => p.scope === scope);

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

  async function handleInstall(pluginId: PluginId) {
    if (installing()) return;
    setInstalling(pluginId);
    try {
      const res = await api<{ success: boolean; installCount: number }>(
        `/api/plugins/${pluginId}/install`,
        { method: "POST" },
      );
      mutate((prev) =>
        prev?.map((p) =>
          p.id === pluginId
            ? {
                ...p,
                installed: true,
                installCount: res.installCount,
                installedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
      showToast("Plugin installed", "info");
    } catch (err) {
      handleApiError(err, "Failed to install plugin");
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Plugins</h2>
        <p class="text-sm text-muted-foreground">Extend UnCorded with integrations and tools.</p>
      </div>

      {/* Search + Filters */}
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1">
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
            placeholder="Search plugins by name, description, or tags..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-input py-2 pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-shadow duration-200 focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <select
          value={categoryFilter()}
          onChange={(e) => setCategoryFilter(e.currentTarget.value)}
          class="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
        >
          <option value="all">All Categories</option>
          <For each={categories()}>{(cat) => <option value={cat}>{cat}</option>}</For>
        </select>

        <select
          value={scopeFilter()}
          onChange={(e) => setScopeFilter(e.currentTarget.value)}
          class="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
        >
          <option value="all">All Scopes</option>
          <option value="personal">Personal</option>
          <option value="both">Personal + Server</option>
        </select>
      </div>

      {/* Plugin cards */}
      <Show
        when={!plugins.loading}
        fallback={
          <div class="space-y-3">
            <div class="h-40 animate-skeleton rounded-xl border border-border bg-muted" />
          </div>
        }
      >
        <Show
          when={!plugins.error}
          fallback={
            <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p class="text-sm text-destructive">Failed to load plugins.</p>
              <Button variant="outline" size="sm" class="mt-2" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={filteredPlugins()}>
              {(plugin) => (
                <PluginCard
                  plugin={toCardData(plugin)}
                  actions={
                    <Show
                      when={plugin.installed}
                      fallback={
                        <Button
                          size="sm"
                          onClick={() => handleInstall(plugin.id)}
                          disabled={installing() === plugin.id}
                        >
                          {installing() === plugin.id ? "Installing..." : "Install for Me"}
                        </Button>
                      }
                    >
                      <A href={`/settings/plugins/${plugin.id}`}>
                        <Button size="sm" variant="outline">
                          <svg
                            class="mr-1.5 h-3.5 w-3.5 text-success"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2.5"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          Installed
                        </Button>
                      </A>
                    </Show>
                  }
                />
              )}
            </For>

            <Show when={filteredPlugins().length === 0}>
              <div class="rounded-lg border border-border p-6 text-center">
                <p class="text-sm text-muted-foreground">
                  {search() ? "No plugins match your search." : "No plugins available yet."}
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      {/* Footer */}
      <div class="border-t border-border pt-4">
        <p class="text-xs text-muted-foreground">
          Want to build a plugin?{" "}
          <A href="/features" class="text-primary hover:underline">
            Submit a Plugin &rarr;
          </A>
        </p>
      </div>
    </div>
  );
};

export default PluginsSettings;
