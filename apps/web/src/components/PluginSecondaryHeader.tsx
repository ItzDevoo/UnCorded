import { Show } from "solid-js";

interface PluginSecondaryHeaderProps {
  pluginName?: string;
  hasSidebar: boolean;
  showSidebar: boolean;
  onToggle: () => void;
}

const PluginSecondaryHeader = (props: PluginSecondaryHeaderProps) => {
  return (
    <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <Show when={props.pluginName}>
        <span class="font-semibold text-foreground">{props.pluginName}</span>
      </Show>
      <div class="ml-auto">
        <Show when={props.hasSidebar}>
          <button
            type="button"
            class={`rounded p-1.5 transition-colors ${
              props.showSidebar
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
            onClick={props.onToggle}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </Show>
      </div>
    </div>
  );
};

export default PluginSecondaryHeader;
