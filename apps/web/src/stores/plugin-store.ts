import { createSignal, createRoot } from "solid-js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PluginInfo {
  id: string;
  name: string;
  icon: string | null;
  uiSlot: "content" | "panel";
  header: boolean;
  rightPanel: boolean;
  status: "running" | "stopped" | "crashed" | "starting";
  port: number;
  scope: "server" | "personal";
  tunnelUrl: string | null;
  permissions: string[];
}

// ── Desktop detection ──────────────────────────────────────────────────────

export const isDesktop = () =>
  typeof window !== "undefined" && "desktopBridge" in window;

// ── Signals ────────────────────────────────────────────────────────────────

const [plugins, setPlugins] = createSignal<PluginInfo[]>([]);
const [activePluginId, setActivePluginId] = createSignal<string | null>(null);

const activePlugin = () => plugins().find((p) => p.id === activePluginId()) ?? null;

/** Plugins visible in the sidebar (running or starting). */
const visiblePlugins = () =>
  plugins().filter((p) => p.status === "running" || p.status === "starting");

function clearActivePlugin() {
  setActivePluginId(null);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let unsubStateChange: (() => void) | null = null;
let disposeRoot: (() => void) | null = null;

function teardown() {
  unsubStateChange?.();
  unsubStateChange = null;
  disposeRoot?.();
  disposeRoot = null;
}

export function setupPluginStore(): void {
  teardown();

  if (!isDesktop()) return; // No plugin UI in browser

  disposeRoot = createRoot((dispose) => {
    // Fetch initial plugin list
    window.desktopBridge!.plugins
      .getAll()
      .then((list) => setPlugins(list))
      .catch((err: unknown) => {
        if (import.meta.env.DEV) console.error("[plugin-store] getAll failed:", err);
      });

    // Subscribe to state changes from main process
    unsubStateChange = window.desktopBridge!.plugins.onStateChange((list) => {
      setPlugins(list);

      // If the active plugin was removed or stopped, clear selection
      const active = activePluginId();
      if (active) {
        const match = list.find((p) => p.id === active);
        if (!match || match.status === "stopped") {
          setActivePluginId(null);
        }
      }
    });

    return dispose;
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => teardown());
}

// ── Exports ────────────────────────────────────────────────────────────────

export {
  plugins,
  setPlugins,
  activePluginId,
  setActivePluginId,
  activePlugin,
  visiblePlugins,
  clearActivePlugin,
};
