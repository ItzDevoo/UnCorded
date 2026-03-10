import { Show, splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/cn.js";

interface EmptyProps extends JSX.HTMLAttributes<HTMLDivElement> {
  icon?: JSX.Element;
  title: string;
  description?: string;
}

const Empty = (props: EmptyProps) => {
  const [local, rest] = splitProps(props, ["class", "icon", "title", "description", "children"]);
  return (
    <div
      data-slot="empty"
      class={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center", local.class)}
      {...rest}
    >
      <Show when={local.icon}>
        <div class="text-muted-foreground [&_svg]:size-12">{local.icon}</div>
      </Show>
      <div class="flex max-w-sm flex-col items-center gap-1">
        <h3 class="text-lg font-semibold text-foreground">{local.title}</h3>
        <Show when={local.description}>
          <p class="text-sm text-muted-foreground">{local.description}</p>
        </Show>
      </div>
      <Show when={local.children}>
        <div class="flex items-center gap-3">{local.children}</div>
      </Show>
    </div>
  );
};

export { Empty };
export type { EmptyProps };
