import {
  createSignal,
  createEffect,
  createContext,
  useContext,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "../../lib/cn.js";

interface MenuContextValue {
  open: () => boolean;
  setOpen: (v: boolean) => void;
  triggerRef: () => HTMLButtonElement | undefined;
  setTriggerRef: (el: HTMLButtonElement) => void;
  repositionVersion: () => number;
}

const MenuContext = createContext<MenuContextValue>();

function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("Menu components must be used within <Menu>");
  return ctx;
}

const Menu = (props: { children: JSX.Element }) => {
  const [open, setOpen] = createSignal(false);
  const [triggerRef, setTriggerRef] = createSignal<HTMLButtonElement>();
  const [repositionVersion, setRepositionVersion] = createSignal(0);

  createEffect(() => {
    if (!open()) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const handleReposition = () => {
      setRepositionVersion((v) => v + 1);
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    });
  });

  const ctx: MenuContextValue = {
    open,
    setOpen,
    triggerRef,
    setTriggerRef,
    repositionVersion,
  };

  return <MenuContext.Provider value={ctx}>{props.children}</MenuContext.Provider>;
};

const MenuTrigger = (props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const [local, rest] = splitProps(props, ["class", "children", "onClick"]);
  const ctx = useMenu();

  return (
    <button
      ref={(el) => ctx.setTriggerRef(el)}
      data-slot="menu-trigger"
      class={local.class}
      onClick={(e) => {
        ctx.setOpen(!ctx.open());
        if (typeof local.onClick === "function") local.onClick(e);
      }}
      {...rest}
    >
      {local.children}
    </button>
  );
};

const FLIP_THRESHOLD = 200;
const ESTIMATED_MENU_WIDTH = 170;

const MenuContent = (props: { children: JSX.Element; class?: string }) => {
  const ctx = useMenu();
  const [pos, setPos] = createSignal({ top: 0, left: 0 });

  function updatePosition() {
    const trigger = ctx.triggerRef();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < FLIP_THRESHOLD ? rect.top - 8 : rect.bottom + 4;
    const left = Math.min(rect.right, window.innerWidth - ESTIMATED_MENU_WIDTH);
    setPos({ top, left });
  }

  // Reposition when version bumps (scroll/resize)
  createEffect(() => {
    ctx.repositionVersion();
    updatePosition();
  });

  return (
    <Show when={ctx.open()}>
      <Portal mount={document.body}>
        {/* Backdrop */}
        <div class="fixed inset-0 z-[--z-dropdown]" onClick={() => ctx.setOpen(false)} />
        {/* Content */}
        <div
          data-slot="menu-content"
          class={cn(
            "fixed z-[--z-dropdown] min-w-[160px] rounded-xl border border-border bg-popover p-1 shadow-md animate-scale-in",
            props.class,
          )}
          style={{
            top: `${pos().top}px`,
            left: `${pos().left}px`,
          }}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
};

interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

const MenuItem = (props: MenuItemProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "destructive", "onClick"]);
  const ctx = useMenu();

  return (
    <button
      data-slot="menu-item"
      class={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        local.destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-popover-foreground hover:bg-accent",
        local.class,
      )}
      onClick={(e) => {
        ctx.setOpen(false);
        if (typeof local.onClick === "function") local.onClick(e);
      }}
      {...rest}
    >
      {local.children}
    </button>
  );
};

const MenuSeparator = () => <div data-slot="menu-separator" class="mx-1 my-1 h-px bg-border" />;

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator };
