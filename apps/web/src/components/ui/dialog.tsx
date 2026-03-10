import {
  Show,
  onMount,
  onCleanup,
  createUniqueId,
  createContext,
  useContext,
  splitProps,
  type JSX,
} from "solid-js";
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

// ── Context for aria-labelledby ─────────────────────────────────────────────

interface DialogContextValue {
  titleId: string;
}

const DialogContext = createContext<DialogContextValue>();

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: JSX.Element;
}

const Dialog = (props: DialogProps) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;
    if (e.key === "Escape") props.onOpenChange(false);
  };

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  return <Show when={props.open}>{props.children}</Show>;
};

const DialogOverlay = (props: JSX.HTMLAttributes<HTMLDivElement>) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dialog-overlay"
      class={cn("fixed inset-0 bg-black/50 pointer-events-none backdrop-blur-sm", local.class)}
      {...rest}
    />
  );
};

interface DialogContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

const DialogContent = (props: DialogContentProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "onClose"]);
  const titleId = createUniqueId();
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let panelRef!: HTMLDivElement;

  onMount(() => {
    const first = panelRef.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    lockScroll();
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
    <DialogContext.Provider value={{ titleId }}>
      <Portal mount={document.body}>
        <div
          class="fixed inset-0 z-[--z-modal] flex items-center justify-center"
          onClick={() => local.onClose?.()}
        >
          <DialogOverlay />
          <div
            ref={panelRef}
            data-slot="dialog-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            class={cn(
              "relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-md animate-scale-in",
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
    </DialogContext.Provider>
  );
};

type DivProps = JSX.HTMLAttributes<HTMLDivElement>;

const DialogHeader = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="dialog-header" class={cn("mb-4 flex flex-col gap-1.5", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const DialogFooter = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div data-slot="dialog-footer" class={cn("flex justify-end gap-3", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const DialogTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  const ctx = useContext(DialogContext);
  return (
    <h2
      id={ctx?.titleId}
      data-slot="dialog-title"
      class={cn("text-xl font-semibold text-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
};

const DialogDescription = (props: JSX.HTMLAttributes<HTMLParagraphElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <p
      data-slot="dialog-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
};

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollLockCount = 0;
    document.body.style.overflow = "";
  });
}

export {
  Dialog,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
