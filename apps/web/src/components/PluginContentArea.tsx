import { createSignal, Show, onMount, onCleanup } from "solid-js";
import type { PluginInfo } from "../stores/plugin-store.js";
import { buildPluginIframeUrl } from "../stores/plugin-store.js";
import { Sheet, SheetContent } from "./ui/sheet.js";
import { createSwipeGesture } from "../lib/create-swipe-gesture.js";
import PluginFrame from "./PluginFrame.js";
import PluginSecondaryHeader from "./PluginSecondaryHeader.js";

interface PluginContentAreaProps {
  plugin: PluginInfo;
  tunnelUrl: string | null;
}

const PluginContentArea = (props: PluginContentAreaProps) => {
  const [showSidebar, setShowSidebar] = createSignal(false);
  const [useSheet, setUseSheet] = createSignal(true);

  // Responsive breakpoint — matches ChatArea pattern exactly
  let mql: MediaQueryList | null = null;
  const handleResize = (e: MediaQueryListEvent) => setUseSheet(!e.matches);
  onMount(() => {
    mql = window.matchMedia("(min-width: 1280px)");
    setUseSheet(!mql.matches);
    mql.addEventListener("change", handleResize);
  });
  onCleanup(() => mql?.removeEventListener("change", handleResize));

  // Swipe gesture for sheet sidebar
  const [sidebarPanelRef, setSidebarPanelRef] = createSignal<HTMLDivElement | undefined>();
  createSwipeGesture({
    target: sidebarPanelRef,
    direction: "right",
    enabled: () => useSheet() && showSidebar(),
    onSwipe: () => setShowSidebar(false),
  });

  const hasSidebar = () => props.plugin.sidebar === true;

  const sidebarUrl = () => buildPluginIframeUrl(props.plugin, "/sidebar", props.tunnelUrl);

  return (
    <>
      <PluginSecondaryHeader
        hasSidebar={hasSidebar()}
        showSidebar={showSidebar()}
        onToggle={() => setShowSidebar((prev) => !prev)}
      />

      <div class="flex min-h-0 flex-1 overflow-hidden">
        {/* Main plugin iframe */}
        <div class="flex-1 overflow-hidden">
          <PluginFrame plugin={props.plugin} tunnelUrl={props.tunnelUrl} />
        </div>

        {/* Inline sidebar — desktop (>=1280px) */}
        <Show when={!useSheet() && hasSidebar() && showSidebar() && sidebarUrl()}>
          <div class="w-60 shrink-0 border-l border-border">
            <iframe
              src={sidebarUrl()!}
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
              allow="clipboard-write"
              referrerpolicy="origin"
              class="h-full w-full border-none"
              data-plugin-id={props.plugin.id}
              title={`${props.plugin.name} Sidebar`}
            />
          </div>
        </Show>
      </div>

      {/* Sheet sidebar — mobile (<1280px) */}
      <Show when={useSheet() && hasSidebar()}>
        <Sheet open={showSidebar()} onOpenChange={setShowSidebar} side="right">
          <SheetContent
            side="right"
            onClose={() => setShowSidebar(false)}
            onPanelRef={setSidebarPanelRef}
          >
            <Show when={sidebarUrl()}>
              <iframe
                src={sidebarUrl()!}
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                allow="clipboard-write"
                referrerpolicy="origin"
                class="h-full w-full border-none"
                data-plugin-id={props.plugin.id}
                title={`${props.plugin.name} Sidebar`}
              />
            </Show>
          </SheetContent>
        </Sheet>
      </Show>
    </>
  );
};

export default PluginContentArea;
