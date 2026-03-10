import { createSignal, Show, splitProps, type JSX, type ParentProps } from "solid-js";
import { cn } from "../../lib/cn.js";
import { ScrollArea } from "./scroll-area.js";

// ── Sidebar ─────────────────────────────────────────────────────────────────

type SidebarProps = ParentProps<JSX.HTMLAttributes<HTMLElement>>;

const Sidebar = (props: SidebarProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <aside
      data-slot="sidebar"
      class={cn("flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar", local.class)}
      {...rest}
    >
      {local.children}
    </aside>
  );
};

// ── SidebarHeader ───────────────────────────────────────────────────────────

type SidebarHeaderProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarHeader = (props: SidebarHeaderProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="sidebar-header" class={cn("flex shrink-0 flex-col gap-2 p-3", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

// ── SidebarContent ──────────────────────────────────────────────────────────

type SidebarContentProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarContent = (props: SidebarContentProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <ScrollArea data-slot="sidebar-content" class={cn("flex-1 overflow-hidden", local.class)} {...rest}>
      {local.children}
    </ScrollArea>
  );
};

// ── SidebarFooter ───────────────────────────────────────────────────────────

type SidebarFooterProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarFooter = (props: SidebarFooterProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-footer"
      class={cn("flex shrink-0 items-center border-t border-border p-2", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

// ── SidebarGroup ────────────────────────────────────────────────────────────

interface SidebarGroupProps extends ParentProps<JSX.HTMLAttributes<HTMLDivElement>> {
  label?: string;
  actions?: JSX.Element;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const SidebarGroup = (props: SidebarGroupProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "label", "actions", "collapsible", "defaultOpen"]);
  const [open, setOpen] = createSignal(local.defaultOpen ?? true);

  return (
    <div data-slot="sidebar-group" class={cn("py-1", local.class)} {...rest}>
      <Show when={local.label}>
        <div class="flex items-center gap-1 px-4 py-1.5">
          <button
            type="button"
            class="flex flex-1 items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"
            classList={{ "cursor-pointer hover:text-foreground": !!local.collapsible }}
            onClick={() => local.collapsible && setOpen((o) => !o)}
          >
            <span class="flex-1 text-left">{local.label}</span>
            <Show when={local.collapsible}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5 transition-transform"
                classList={{ "rotate-0": open(), "-rotate-90": !open() }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </Show>
          </button>
          <Show when={local.actions}>
            <div class="flex items-center gap-0.5">{local.actions}</div>
          </Show>
        </div>
      </Show>
      <Show when={!local.collapsible || open()}>{local.children}</Show>
    </div>
  );
};

// ── SidebarMenu ─────────────────────────────────────────────────────────────

type SidebarMenuProps = ParentProps<JSX.HTMLAttributes<HTMLUListElement>>;

const SidebarMenu = (props: SidebarMenuProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <ul data-slot="sidebar-menu" class={cn("flex flex-col gap-0.5 px-2", local.class)} {...rest}>
      {local.children}
    </ul>
  );
};

// ── SidebarMenuItem ─────────────────────────────────────────────────────────

type SidebarMenuItemProps = ParentProps<JSX.HTMLAttributes<HTMLLIElement>>;

const SidebarMenuItem = (props: SidebarMenuItemProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <li data-slot="sidebar-menu-item" class={cn("group/menu-item relative", local.class)} {...rest}>
      {local.children}
    </li>
  );
};

// ── SidebarMenuButton ───────────────────────────────────────────────────────

interface SidebarMenuButtonProps extends ParentProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>> {
  active?: boolean;
}

const SidebarMenuButton = (props: SidebarMenuButtonProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "active"]);
  return (
    <button
      data-slot="sidebar-menu-button"
      class={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        local.active ? "bg-accent font-medium text-foreground" : "text-secondary-foreground hover:bg-accent hover:text-foreground",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
};

// ── SidebarMenuAction ───────────────────────────────────────────────────────

type SidebarMenuActionProps = ParentProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>;

const SidebarMenuAction = (props: SidebarMenuActionProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <button
      data-slot="sidebar-menu-action"
      class={cn(
        "absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:text-foreground",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
};

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
};
