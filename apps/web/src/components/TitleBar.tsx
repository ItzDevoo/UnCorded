import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "./ui/menu.js";

export default function TitleBar() {
  const bridge = window.desktopBridge;
  if (!bridge) return null;

  const [maximized, setMaximized] = createSignal(false);

  onMount(async () => {
    setMaximized(await bridge.isMaximized());
    const unsub = bridge.onMaximizeChange(setMaximized);
    onCleanup(unsub);
  });

  return (
    <div
      class="flex h-8 shrink-0 select-none items-center bg-sidebar text-sidebar-foreground"
      style={{ "-webkit-app-region": "drag" }}
    >
      {/* Left: icon + app name */}
      <div class="flex items-center gap-2 pl-3">
        <img src="/favicon.ico" alt="" class="h-4 w-4" draggable={false} />
        <span class="text-xs font-medium text-muted-foreground">UnCorded</span>
      </div>

      {/* Spacer */}
      <div class="flex-1" />

      {/* Right: menu + window controls */}
      <div class="flex items-center" style={{ "-webkit-app-region": "no-drag" }}>
        <TitleBarMenu />
        <WindowButton label="Minimize" onClick={() => bridge.minimize()}>
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </WindowButton>
        <WindowButton label={maximized() ? "Restore" : "Maximize"} onClick={() => bridge.maximize()}>
          <Show
            when={maximized()}
            fallback={
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            }
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="2.5" y="0.5" width="7" height="7" />
              <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" />
            </svg>
          </Show>
        </WindowButton>
        <WindowButton label="Close" onClick={() => bridge.close()} variant="close">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </WindowButton>
      </div>
    </div>
  );
}

function WindowButton(props: {
  label: string;
  onClick: () => void;
  variant?: "close";
  children: import("solid-js").JSX.Element;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      class={`flex h-8 w-11 items-center justify-center text-sidebar-foreground/70 transition-colors ${
        props.variant === "close"
          ? "hover:bg-destructive hover:text-white"
          : "hover:bg-muted"
      }`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function TitleBarMenu() {
  const bridge = window.desktopBridge!;
  const [version, setVersion] = createSignal("");

  onMount(async () => {
    setVersion(await bridge.menu.getVersion());
  });

  return (
    <Menu>
      <MenuTrigger
        class="flex h-8 w-10 items-center justify-center text-sidebar-foreground/70 hover:bg-muted"
        aria-label="Menu"
        title="Menu"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </MenuTrigger>
      <MenuContent class="mt-1">
        {/* Edit */}
        <div class="px-2.5 py-1 text-xs font-semibold text-muted-foreground">Edit</div>
        <MenuItem onClick={() => document.execCommand("undo")}>Undo</MenuItem>
        <MenuItem onClick={() => document.execCommand("redo")}>Redo</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => document.execCommand("cut")}>Cut</MenuItem>
        <MenuItem onClick={() => document.execCommand("copy")}>Copy</MenuItem>
        <MenuItem onClick={() => document.execCommand("paste")}>Paste</MenuItem>
        <MenuItem onClick={() => document.execCommand("selectAll")}>Select All</MenuItem>
        <MenuSeparator />

        {/* View */}
        <div class="px-2.5 py-1 text-xs font-semibold text-muted-foreground">View</div>
        <MenuItem onClick={() => bridge.menu.reload()}>Reload</MenuItem>
        <MenuItem onClick={() => bridge.menu.toggleDevTools()}>Toggle DevTools</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => bridge.menu.zoomIn()}>Zoom In</MenuItem>
        <MenuItem onClick={() => bridge.menu.zoomOut()}>Zoom Out</MenuItem>
        <MenuItem onClick={() => bridge.menu.resetZoom()}>Reset Zoom</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => bridge.menu.toggleFullscreen()}>Fullscreen</MenuItem>
        <MenuSeparator />

        {/* Help */}
        <div class="px-2.5 py-1 text-xs font-semibold text-muted-foreground">Help</div>
        <MenuItem onClick={() => bridge.menu.checkUpdates()}>Check for Updates</MenuItem>
        <MenuItem disabled>
          <span class="text-muted-foreground">About UnCorded v{version()}</span>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
