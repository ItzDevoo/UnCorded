import { For, splitProps } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

// ── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = "info" | "error";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// ── Store ───────────────────────────────────────────────────────────────────

const [toasts, setToasts] = createStore<Toast[]>([]);

let nextId = 0;

export function showToast(message: string, variant: ToastVariant = "info"): void {
  const id = String(++nextId);
  setToasts(produce((arr) => arr.push({ id, message, variant })));
  setTimeout(() => dismissToast(id), 5_000);
}

export function dismissToast(id: string): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

// ── Variants ────────────────────────────────────────────────────────────────

export const toastVariants = cva(
  "rounded-lg border px-4 py-3 text-sm shadow-md cursor-pointer select-none",
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
  const [local, rest] = splitProps(props, ["class", "id", "message", "variant"]);
  return (
    <div
      data-slot="toast"
      role="alert"
      class={cn(toastVariants({ variant: local.variant }), local.class)}
      onClick={() => dismissToast(local.id)}
      {...rest}
    >
      {local.message}
    </div>
  );
};

export const ToastContainer = () => {
  return (
    <Portal mount={document.body}>
      <div class="fixed bottom-4 right-4 z-[--z-toast] flex flex-col-reverse gap-2">
        <For each={toasts}>{(toast) => <ToastItem {...toast} />}</For>
      </div>
    </Portal>
  );
};
