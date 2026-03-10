import { createSignal, Show, splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

const TOOLTIP_DELAY_MS = 200;

interface TooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: JSX.Element;
  class?: string;
}

const positionClasses: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

const Tooltip = (props: TooltipProps) => {
  const [local, rest] = splitProps(props, ["content", "side", "delay", "children", "class"]);

  const [visible, setVisible] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const side = () => local.side ?? "top";
  const delayMs = () => local.delay ?? TOOLTIP_DELAY_MS;

  const handleEnter = () => {
    timer = setTimeout(() => setVisible(true), delayMs());
  };

  const handleLeave = () => {
    clearTimeout(timer);
    setVisible(false);
  };

  return (
    <div
      data-slot="tooltip"
      class={cn("relative inline-flex", local.class)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {local.children}
      <Show when={visible()}>
        <div
          class={cn(
            "absolute z-[--z-tooltip] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md",
            positionClasses[side()] ?? positionClasses.top,
          )}
        >
          {local.content}
        </div>
      </Show>
    </div>
  );
};

export { Tooltip };
export type { TooltipProps };
