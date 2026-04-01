import { Show, For, type JSX } from "solid-js";

export interface PluginCardData {
  id: string;
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
}

interface PluginCardProps {
  plugin: PluginCardData;
  /** Status indicator (e.g., "Running", "Stopped") — shown as a dot + label */
  status?: { label: string; color: string } | undefined;
  /** Extra badge rendered after the status indicator */
  badge?: JSX.Element | undefined;
  /** Action buttons rendered on the right side */
  actions?: JSX.Element | undefined;
}

const PluginIcon = () => (
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
      d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
    />
  </svg>
);

export const PluginCard = (props: PluginCardProps) => {
  const p = () => props.plugin;

  return (
    <div
      class={`rounded-xl border p-4 transition-colors hover:border-border/80 ${
        p().featured ? "border-warning/30 bg-warning/5" : "border-border bg-card"
      }`}
    >
      <div class="flex items-start gap-3">
        {/* Icon */}
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PluginIcon />
        </div>

        {/* Content */}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-foreground">{p().name}</span>
            <Show when={p().verified}>
              <span
                class="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
                title="Verified"
              >
                <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clip-rule="evenodd"
                  />
                </svg>
                Verified
              </span>
            </Show>
            <Show when={p().featured}>
              <span class="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                Featured
              </span>
            </Show>
            <Show when={props.status}>
              {(status) => (
                <span class="flex items-center gap-1 text-xs text-muted-foreground">
                  <span class={`inline-block h-1.5 w-1.5 rounded-full ${status().color}`} />
                  {status().label}
                </span>
              )}
            </Show>
            <Show when={props.badge}>{props.badge}</Show>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">{p().description}</p>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>By {p().author}</span>
            <span class="rounded bg-muted px-1.5 py-0.5">{p().category}</span>
            <Show when={p().scope !== "server"}>
              <span>{p().installCount} {p().installCount === 1 ? "install" : "installs"}</span>
            </Show>
            <Show when={p().downloads > 0}>
              <span>{p().downloads.toLocaleString()} {p().downloads === 1 ? "download" : "downloads"}</span>
            </Show>
            <span class="font-mono">v{p().version}</span>
          </div>
          <Show when={p().tags.length > 0}>
            <div class="mt-2 flex flex-wrap gap-1">
              <For each={p().tags}>
                {(tag) => (
                  <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Actions slot */}
        <Show when={props.actions}>
          <div class="shrink-0">{props.actions}</div>
        </Show>
      </div>
    </div>
  );
};
