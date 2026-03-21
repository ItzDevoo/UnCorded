import { For, Show, splitProps } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

// ── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = "info" | "error";

interface Toast {
  id: string;
  message: string;
  subtitle?: string | undefined;
  variant: ToastVariant;
  onClick?: (() => void) | undefined;
}

// ── Store ───────────────────────────────────────────────────────────────────

const [toasts, setToasts] = createStore<Toast[]>([]);

const TOAST_AUTO_DISMISS_MS = 5_000;
let nextId = 0;

export function showToast(
  message: string,
  variant: ToastVariant = "info",
  options?: {
    id?: string | undefined;
    subtitle?: string | undefined;
    onClick?: (() => void) | undefined;
    durationMs?: number | undefined;
  },
): string {
  const id = options?.id ?? String(++nextId);
  // If a toast with this ID already exists, skip
  if (toasts.some((t) => t.id === id)) return id;
  setToasts(
    produce((arr) =>
      arr.push({
        id,
        message,
        subtitle: options?.subtitle,
        variant,
        onClick: options?.onClick,
      }),
    ),
  );
  setTimeout(() => dismissToast(id), options?.durationMs ?? TOAST_AUTO_DISMISS_MS);
  return id;
}

export function dismissToast(id: string): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

// ── Variants ────────────────────────────────────────────────────────────────

export const toastVariants = cva(
  "rounded-lg border px-4 py-3 text-sm shadow-sm cursor-pointer select-none animate-slide-in",
  {
    variants: {
      variant: {
        info: "border-border bg-card text-card-foreground",
        error: "border-destructive/50 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

// ── Components ──────────────────────────────────────────────────────────────

type ToastItemProps = Toast & { class?: string };

const ToastItem = (props: ToastItemProps) => {
  const [local, rest] = splitProps(props, ["class", "id", "message", "subtitle", "variant", "onClick"]);
  return (
    <div
      data-slot="toast"
      role="alert"
      class={cn(toastVariants({ variant: local.variant }), local.class)}
      onClick={() => {
        local.onClick?.();
        dismissToast(local.id);
      }}
      {...rest}
    >
      <p>{local.message}</p>
      <Show when={local.subtitle}>
        <p class="mt-0.5 text-xs text-muted-foreground">{local.subtitle}</p>
      </Show>
    </div>
  );
};

export const ToastContainer = () => {
  return (
    <Portal mount={document.body}>
      <div class="fixed bottom-4 right-4 z-70 flex flex-col-reverse gap-2">
        <For each={toasts}>{(toast) => <ToastItem {...toast} />}</For>
      </div>
    </Portal>
  );
};
