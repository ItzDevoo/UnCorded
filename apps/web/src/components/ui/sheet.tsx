import { Show, onMount, onCleanup, splitProps, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "../../lib/cn.js";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLockCount = 0;

function lockScroll() {
  scrollLockCount++;
  if (scrollLockCount === 1) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  scrollLockCount--;
  if (scrollLockCount === 0) document.body.style.overflow = "";
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: JSX.Element;
  side?: "left" | "right";
}

const Sheet = (props: SheetProps) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;
    if (e.key === "Escape") props.onOpenChange(false);
  };

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return <Show when={props.open}>{props.children}</Show>;
};

interface SheetContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right";
  onClose?: () => void;
}

const SheetContent = (props: SheetContentProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "side", "onClose"]);
  const side = () => local.side ?? "left";
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let panelRef!: HTMLDivElement;

  onMount(() => {
    lockScroll();
    const first = panelRef.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  });

  onCleanup(() => {
    unlockScroll();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = [...panelRef.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first && last) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last && first) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <Portal mount={document.body}>
      <div class="fixed inset-0 z-50 flex" onClick={() => local.onClose?.()}>
        {/* Overlay */}
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Panel */}
        <div
          ref={panelRef}
          data-slot="sheet-content"
          role="dialog"
          aria-modal="true"
          class={cn(
            "relative h-full w-72 bg-sidebar pt-[env(safe-area-inset-top)]",
            side() === "left"
              ? "fixed left-0 top-0 animate-slide-in-left pl-[env(safe-area-inset-left)]"
              : "fixed right-0 top-0 animate-slide-in-right pr-[env(safe-area-inset-right)]",
            local.class,
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {local.children}
        </div>
      </div>
    </Portal>
  );
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollLockCount = 0;
    document.body.style.overflow = "";
  });
}

export { Sheet, SheetContent };
