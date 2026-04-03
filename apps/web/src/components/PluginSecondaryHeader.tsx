import { Show } from "solid-js";

interface PluginSecondaryHeaderProps {
  pluginName?: string;
  hasSidebar: boolean;
  showSidebar: boolean;
  onToggle: () => void;
}

const PluginSecondaryHeader = (props: PluginSecondaryHeaderProps) => {
  return (
    <div class="flex h-14 shrink-0 items-center border-b border-border px-6">
      <Show when={props.pluginName}>
        <span class="text-lg font-semibold text-foreground">{props.pluginName}</span>
      </Show>
      <div class="flex-1" />
      <Show when={props.hasSidebar}>
        <button
          type="button"
          class={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
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
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h8m-8 6h16M3 18h8" />
          </svg>
        </button>
      </Show>
    </div>
  );
};

export default PluginSecondaryHeader;
