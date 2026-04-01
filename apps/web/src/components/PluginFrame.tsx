import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import type { PluginInfo } from "../stores/plugin-store.js";
import { isDesktop } from "../stores/plugin-store.js";
import { Empty } from "./ui/empty.js";

interface PluginFrameProps {
  plugin: PluginInfo;
  /** Override URL for server plugins loaded via tunnel */
  tunnelUrl?: string | null;
}

const PluginFrame = (props: PluginFrameProps) => {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);

  const isCrashed = () =>
    props.plugin.status === "crashed" || props.plugin.status === "stopped";

  const isStarting = () => props.plugin.status === "starting";

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleRestart = () => {
    if (!isDesktop()) return;
    window.desktopBridge!.plugins.restart(props.plugin.id).catch((err: unknown) => {
      if (import.meta.env.DEV) console.error("[PluginFrame] restart failed:", err);
    });
  };

  // Determine the iframe URL based on scope
  const iframeUrl = () => {
    // Tunnel URL takes priority (server plugin for browser user)
    if (props.tunnelUrl) {
      if (!props.tunnelUrl.startsWith("https://")) return null;
      return props.tunnelUrl;
    }
    // Server plugin with tunnel URL from plugin info
    if (props.plugin.scope === "server" && props.plugin.tunnelUrl) {
      if (!props.plugin.tunnelUrl.startsWith("https://")) return null;
      return props.plugin.tunnelUrl;
    }
    // Local plugin (personal or server on desktop owner)
    if (props.plugin.port) return `http://localhost:${props.plugin.port}/`;
    return null;
  };

  const isOffline = () => !iframeUrl();

  // Longer timeout for tunnel URLs (network latency)
  const timeoutMs = () =>
    (props.tunnelUrl || props.plugin.tunnelUrl) ? 20_000 : 15_000;

  // Reactive timeout — restarts when plugin ID or timeout duration changes
  createEffect(() => {
    void props.plugin.id; // track plugin switches (SolidJS reactivity)
    const ms = timeoutMs();
    setLoading(true);
    setError(false);

    const timeout = setTimeout(() => {
      if (loading()) {
        setLoading(false);
        setError(true);
      }
    }, ms);

    onCleanup(() => clearTimeout(timeout));
  });

  return (
    <div class="relative flex h-full w-full flex-col bg-background">
      {/* Error / crashed state */}
      <Show when={isCrashed() || error()}>
        <Empty
          title={`Plugin ${isCrashed() ? props.plugin.status : "failed to load"}`}
          description={`"${props.plugin.name}" is not responding.`}
        >
          <button
            type="button"
            onClick={handleRestart}
            class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Restart Plugin
          </button>
        </Empty>
      </Show>

      {/* Starting state */}
      <Show when={isStarting() && !error()}>
        <div class="flex flex-1 items-center justify-center">
          <div class="flex animate-fade-in flex-col items-center gap-3">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p class="text-muted-foreground">Starting {props.plugin.name}...</p>
          </div>
        </div>
      </Show>

      {/* Loading overlay */}
      <Show when={loading() && props.plugin.status === "running"}>
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div class="flex animate-fade-in flex-col items-center gap-3">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p class="text-muted-foreground">Loading {props.plugin.name}...</p>
          </div>
        </div>
      </Show>

      {/* Offline state — server plugin with no tunnel URL */}
      <Show when={isOffline() && !isCrashed() && !error()}>
        <Empty
          title="Plugin offline"
          description={`"${props.plugin.name}" is not currently running on the server owner's machine.`}
        />
      </Show>

      {/* iframe — only render when plugin is running and URL is available */}
      <Show when={(props.plugin.status === "running" || props.tunnelUrl) && !error() && !isOffline()}>
        <iframe
          src={iframeUrl()!}
          sandbox="allow-scripts allow-forms allow-popups"
          allow="clipboard-write"
          referrerpolicy="no-referrer"
          class="h-full w-full border-none"
          data-plugin-id={props.plugin.id}
          onLoad={handleLoad}
          onError={handleError}
          title={props.plugin.name}
        />
      </Show>
    </div>
  );
};

export default PluginFrame;
