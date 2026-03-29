import { createSignal, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { PluginId } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import { showToast } from "../../components/ui/toast.js";
import { Button } from "../../components/ui/button.js";

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
  installCount: number;
  installed: boolean;
  installedAt: string | null;
}

// ── Coming Soon Placeholders (frontend only) ────────────────────────────────

const COMING_SOON_PLUGINS = [
  {
    name: "Custom Themes",
    description: "Personalize your UnCorded experience with community-made themes.",
    icon: "\uD83C\uDFA8",
    category: "Appearance",
  },
  {
    name: "Bot Framework",
    description: "Build custom bots and automations for your servers.",
    icon: "\uD83E\uDD16",
    category: "Developer Tools",
  },
  {
    name: "Webhooks",
    description: "Send and receive webhooks to integrate with external services.",
    icon: "\uD83D\uDD17",
    category: "Automation",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

const PluginsSettings = () => {
  const [search, setSearch] = createSignal("");
  const [installing, setInstalling] = createSignal<PluginId | null>(null);

  const [plugins, { refetch, mutate }] = createResource(async () => {
    const res = await api<{ plugins: Plugin[] }>("/api/plugins");
    return res.plugins;
  });

  // Only show personal/both scope plugins in user settings
  const personalPlugins = () =>
    (plugins() ?? []).filter((p) => p.scope === "personal" || p.scope === "both");

  const filteredPlugins = () => {
    const q = search().toLowerCase();
    if (!q) return personalPlugins();
    return personalPlugins().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  };

  const filteredComingSoon = () => {
    const q = search().toLowerCase();
    if (!q) return COMING_SOON_PLUGINS;
    return COMING_SOON_PLUGINS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  };

  async function handleInstall(pluginId: PluginId) {
    if (installing()) return;
    setInstalling(pluginId);
    try {
      const res = await api<{ success: boolean; installCount: number }>(
        `/api/plugins/${pluginId}/install`,
        { method: "POST" },
      );
      // Optimistically update local state
      mutate((prev) =>
        prev?.map((p) =>
          p.id === pluginId
            ? { ...p, installed: true, installCount: res.installCount, installedAt: new Date().toISOString() }
            : p,
        ),
      );
      showToast("Plugin installed", "info");
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to install plugin";
      showToast(msg, "error");
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Plugins</h2>
        <p class="text-sm text-muted-foreground">
          Extend UnCorded with integrations and tools.
        </p>
      </div>

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

      {/* Plugin cards from API */}
      <Show when={!plugins.loading} fallback={
        <div class="space-y-3">
          <div class="h-40 animate-skeleton rounded-xl border border-border bg-muted" />
        </div>
      }>
        <Show when={!plugins.error} fallback={
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p class="text-sm text-destructive">Failed to load plugins.</p>
            <Button variant="outline" size="sm" class="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        }>
          <div class="space-y-3">
            <For each={filteredPlugins()}>
              {(plugin) => (
                <PluginCard
                  plugin={plugin}
                  installing={installing() === plugin.id}
                  onInstall={() => handleInstall(plugin.id)}
                />
              )}
            </For>

            {/* Coming Soon cards */}
            <For each={filteredComingSoon()}>
              {(plugin) => (
                <div class="rounded-xl border border-border bg-card/50 p-4 opacity-60">
                  <div class="flex items-start gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                      {plugin.icon}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-foreground">{plugin.name}</span>
                        <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Coming Soon
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground">{plugin.description}</p>
                      <p class="mt-2 text-xs text-muted-foreground">{plugin.category}</p>
                    </div>
                  </div>
                </div>
              )}
            </For>
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

// ── Plugin Card ──────────────────────────────────────────────────────────────

function PluginCard(props: {
  plugin: Plugin;
  installing: boolean;
  onInstall: () => void;
}) {
  const p = () => props.plugin;

  return (
    <div class="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div class="flex items-start gap-3">
        {/* Icon */}
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg
            class="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5l-2.147 2.147a2.25 2.25 0 01-.659.591c-.197.12-.417.207-.649.257l-2.095.349a.75.75 0 01-.867-.867l.349-2.095a2.25 2.25 0 01.848-1.308L19.8 14.5z"
            />
          </svg>
        </div>

        {/* Content */}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-foreground">{p().name}</span>
            <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Official
            </span>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">{p().description}</p>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>By {p().author}</span>
            <span class="rounded bg-muted px-1.5 py-0.5">{p().category}</span>
            <span>{p().installCount} {p().installCount === 1 ? "install" : "installs"}</span>
          </div>
        </div>

        {/* Action */}
        <div class="shrink-0">
          <Show
            when={p().installed}
            fallback={
              <Button
                size="sm"
                onClick={(e: MouseEvent) => {
                  e.preventDefault();
                  props.onInstall();
                }}
                disabled={props.installing}
              >
                {props.installing ? "Installing..." : "Install for Me"}
              </Button>
            }
          >
            <A href={`/settings/plugins/${p().id}`}>
              <Button size="sm" variant="outline">
                <svg
                  class="mr-1.5 h-3.5 w-3.5 text-success"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Installed
              </Button>
            </A>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default PluginsSettings;
