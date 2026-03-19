import {
  Show,
  createEffect,
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

interface DialogContextValue {
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue>();

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: JSX.Element;
}

const Dialog = (props: DialogProps) => {
  createEffect(() => {
    if (!props.open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onOpenChange(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return <Show when={props.open}>{props.children}</Show>;
};

interface DialogContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

const DialogContent = (props: DialogContentProps) => {
  const [local, rest] = splitProps(props, ["class", "children", "onClose"]);
  const titleId = createUniqueId();
  const descriptionId = createUniqueId();
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let panelRef!: HTMLDivElement;

  onMount(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (first) {
      first.focus();
    } else {
      panelRef.focus();
    }
    lockScroll();

    onCleanup(() => {
      unlockScroll();
      previouslyFocused?.focus();
    });
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
    <DialogContext.Provider value={{ titleId, descriptionId }}>
      <Portal mount={document.body}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => local.onClose?.()}
        >
          <div class="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            class={cn(
              "relative mx-4 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg animate-scale-in sm:mx-0",
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
    <div class={cn("mb-4 flex flex-col gap-1.5", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const DialogFooter = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("mt-4 flex justify-end gap-3", local.class)} {...rest}>
      {local.children}
    </div>
  );
};

const DialogTitle = (props: JSX.HTMLAttributes<HTMLHeadingElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  const ctx = useContext(DialogContext);

  if (import.meta.env.DEV && !ctx) {
    console.warn("DialogTitle must be used within a DialogContent");
  }

  return (
    <h2
      {...(ctx ? { id: ctx.titleId } : {})}
      class={cn("text-lg font-semibold text-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
};

const DialogDescription = (props: JSX.HTMLAttributes<HTMLParagraphElement>) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  const ctx = useContext(DialogContext);

  if (import.meta.env.DEV && !ctx) {
    console.warn("DialogDescription must be used within a DialogContent");
  }

  return (
    <p
      {...(ctx ? { id: ctx.descriptionId } : {})}
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollLockCount = 0;
    document.body.style.overflow = "";
  });
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
