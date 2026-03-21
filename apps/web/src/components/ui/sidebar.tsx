import {
  createContext,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  useContext,
  Show,
  splitProps,
  type Accessor,
  type Setter,
  type JSX,
  type ParentProps,
} from "solid-js";
import { cn } from "../../lib/cn.js";
import { ScrollArea } from "./scroll-area.js";
import { Sheet, SheetContent } from "./sheet.js";

// ── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

// ── Context ──────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  state: Accessor<"expanded" | "collapsed">;
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
  openMobile: Accessor<boolean>;
  setOpenMobile: Setter<boolean>;
  isMobile: Accessor<boolean>;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue>();

function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider.");
  return ctx;
}

// ── SidebarProvider ──────────────────────────────────────────────────────────

interface SidebarProviderProps extends ParentProps<JSX.HTMLAttributes<HTMLDivElement>> {
  defaultOpen?: boolean;
}

const SidebarProvider = (props: SidebarProviderProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "defaultOpen", "style"]);

  const [open, setOpen] = createSignal(local.defaultOpen ?? true);
  const [openMobile, setOpenMobile] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);

  const state = createMemo<"expanded" | "collapsed">(() => (open() ? "expanded" : "collapsed"));

  const toggleSidebar = () => {
    if (isMobile()) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  };

  // Mobile detection
  let mql: MediaQueryList | null = null;
  const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

  onMount(() => {
    mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    mql.addEventListener("change", handleChange);

    // Keyboard shortcut: Ctrl/Cmd+B
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      mql?.removeEventListener("change", handleChange);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const ctxValue: SidebarContextValue = {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={ctxValue}>
      <div
        data-slot="sidebar-wrapper"
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...(typeof local.style === "object" ? local.style : {}),
        }}
        class={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </SidebarContext.Provider>
  );
};

// ── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarComponentProps extends ParentProps {
  class?: string;
  side?: "left" | "right";
  variant?: "sidebar" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}

const Sidebar = (props: SidebarComponentProps) => {
  const local = props;
  const side = () => local.side ?? "left";
  const variant = () => local.variant ?? "sidebar";
  const collapsible = () => local.collapsible ?? "offcanvas";

  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  // Non-collapsible: simple static sidebar
  const renderNone = () => (
    <aside
      data-slot="sidebar"
      class={cn(
        "flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar text-sidebar-foreground",
        local.class,
      )}
    >
      {local.children}
    </aside>
  );

  // Mobile: render inside a Sheet
  const renderMobile = () => (
    <Sheet open={openMobile()} onOpenChange={setOpenMobile} side={side()}>
      <SheetContent
        side={side()}
        onClose={() => setOpenMobile(false)}
        class="w-[var(--sidebar-width)] p-0"
        style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE }}
      >
        <div class="flex h-full w-full flex-col" data-slot="sidebar" data-mobile="true">
          {local.children}
        </div>
      </SheetContent>
    </Sheet>
  );

  // Desktop: gap div + fixed sidebar
  const renderDesktop = () => {
    const isInset = () => variant() === "inset";
    return (
      <div
        class="group peer hidden text-sidebar-foreground md:block"
        data-state={state()}
        data-collapsible={state() === "collapsed" ? collapsible() : ""}
        data-variant={variant()}
        data-side={side()}
        data-slot="sidebar"
      >
        {/* Gap div — reserves space in flex layout */}
        <div
          data-slot="sidebar-gap"
          class={cn(
            "relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            isInset()
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]"
              : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]",
          )}
        />
        {/* Fixed sidebar container */}
        <div
          data-slot="sidebar-container"
          data-side={side()}
          class={cn(
            "fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",
            "data-[side=left]:left-0 data-[side=right]:right-0",
            "data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
            "data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            isInset()
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]"
              : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l border-border",
            local.class,
          )}
        >
          <div
            data-slot="sidebar-inner"
            class="flex size-full flex-col bg-sidebar"
          >
            {local.children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Show when={collapsible() === "none"}>
        {renderNone()}
      </Show>
      <Show when={collapsible() !== "none" && isMobile()}>
        {renderMobile()}
      </Show>
      <Show when={collapsible() !== "none" && !isMobile()}>
        {renderDesktop()}
      </Show>
    </>
  );
};

// ── SidebarInset ─────────────────────────────────────────────────────────────

const SidebarInset = (props: ParentProps<{ class?: string }>) => {
  return (
    <main
      data-slot="sidebar-inset"
      class={cn(
        "relative flex w-full flex-1 flex-col bg-card overflow-hidden pr-[env(safe-area-inset-right)]",
        "md:peer-data-[variant=inset]:m-2",
        "md:peer-data-[variant=inset]:ml-0",
        "md:peer-data-[variant=inset]:rounded-xl",
        "md:peer-data-[variant=inset]:shadow-sm",
        "md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2",
        props.class,
      )}
    >
      {props.children}
    </main>
  );
};

// ── SidebarTrigger ───────────────────────────────────────────────────────────

type SidebarTriggerProps = ParentProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>;

const SidebarTrigger = (props: SidebarTriggerProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "onClick"]);
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      class={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        local.class,
      )}
      onClick={(e) => {
        if (typeof local.onClick === "function") local.onClick(e);
        toggleSidebar();
      }}
      aria-label="Toggle Sidebar"
      {...rest}
    >
      <Show
        when={local.children}
        fallback={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 6h8m-8 6h16M3 18h8"
            />
          </svg>
        }
      >
        {local.children}
      </Show>
    </button>
  );
};

// ── SidebarHeader ────────────────────────────────────────────────────────────

type SidebarHeaderProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarHeader = (props: SidebarHeaderProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-header"
      class={cn("flex shrink-0 flex-col gap-2 p-3", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

// ── SidebarContent ───────────────────────────────────────────────────────────

type SidebarContentProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarContent = (props: SidebarContentProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <ScrollArea
      data-slot="sidebar-content"
      class={cn("flex-1 overflow-hidden group-data-[collapsible=icon]:overflow-hidden", local.class)}
      {...rest}
    >
      {local.children}
    </ScrollArea>
  );
};

// ── SidebarFooter ────────────────────────────────────────────────────────────

type SidebarFooterProps = ParentProps<JSX.HTMLAttributes<HTMLDivElement>>;

const SidebarFooter = (props: SidebarFooterProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-footer"
      class={cn("flex shrink-0 items-center border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

// ── SidebarGroup ─────────────────────────────────────────────────────────────

interface SidebarGroupProps extends ParentProps<JSX.HTMLAttributes<HTMLDivElement>> {
  label?: string;
  actions?: JSX.Element;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const SidebarGroup = (props: SidebarGroupProps) => {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "label",
    "actions",
    "collapsible",
    "defaultOpen",
  ]);
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

// ── SidebarMenu ──────────────────────────────────────────────────────────────

type SidebarMenuProps = ParentProps<JSX.HTMLAttributes<HTMLUListElement>>;

const SidebarMenu = (props: SidebarMenuProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <ul data-slot="sidebar-menu" class={cn("flex flex-col gap-0.5 px-2", local.class)} {...rest}>
      {local.children}
    </ul>
  );
};

// ── SidebarMenuItem ──────────────────────────────────────────────────────────

type SidebarMenuItemProps = ParentProps<JSX.HTMLAttributes<HTMLLIElement>>;

const SidebarMenuItem = (props: SidebarMenuItemProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <li data-slot="sidebar-menu-item" class={cn("group/menu-item relative", local.class)} {...rest}>
      {local.children}
    </li>
  );
};

// ── SidebarMenuButton ────────────────────────────────────────────────────────

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
        "group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:justify-center",
        "[&>span]:group-data-[collapsible=icon]:hidden",
        local.active
          ? "bg-accent font-medium text-foreground"
          : "text-secondary-foreground hover:bg-accent hover:text-foreground",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
};

// ── SidebarMenuAction ────────────────────────────────────────────────────────

type SidebarMenuActionProps = ParentProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>;

const SidebarMenuAction = (props: SidebarMenuActionProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <button
      data-slot="sidebar-menu-action"
      class={cn(
        "absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:text-foreground",
        "group-data-[collapsible=icon]:hidden",
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
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  useSidebar,
};
