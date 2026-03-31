import { createSignal, For, Show, splitProps } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

// ── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = "info" | "error";
type ToastSource = "uncorded" | "plugin";

interface Toast {
  id: string;
  message: string;
  subtitle?: string | undefined;
  variant: ToastVariant;
  source: ToastSource;
  onClick?: (() => void) | undefined;
}

// ── Store ───────────────────────────────────────────────────────────────────

const [toasts, setToasts] = createStore<Toast[]>([]);

const TOAST_AUTO_DISMISS_MS = 5_000;
const ERROR_AUTO_DISMISS_MS = 8_000;
let nextId = 0;

export function showToast(
  message: string,
  variant: ToastVariant = "info",
  options?: {
    id?: string | undefined;
    subtitle?: string | undefined;
    onClick?: (() => void) | undefined;
    durationMs?: number | undefined;
    source?: ToastSource | undefined;
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
        source: options?.source ?? "uncorded",
        onClick: options?.onClick,
      }),
    ),
  );
  const duration = options?.durationMs ?? (variant === "error" ? ERROR_AUTO_DISMISS_MS : TOAST_AUTO_DISMISS_MS);
  setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: string): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

// ── Variants ────────────────────────────────────────────────────────────────

export const toastVariants = cva(
  "rounded-lg border px-4 py-3 text-sm shadow-sm select-none animate-slide-in",
  {
    variants: {
      variant: {
        info: "border-border bg-card text-card-foreground cursor-pointer",
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

const CopyButton = (props: { text: string }) => {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(props.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-70 transition-opacity hover:opacity-100"
      onClick={handleCopy}
      title="Copy error"
    >
      <Show when={copied()} fallback={
        <>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      }>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Copied
      </Show>
    </button>
  );
};

const ReportButton = (props: { message: string; toastId: string }) => {
  const handleReport = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(props.message);
    dismissToast(props.toastId);
    window.location.hash = "";
    window.location.pathname = "/settings/feedback";
  };

  return (
    <button
      type="button"
      class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-70 transition-opacity hover:opacity-100"
      onClick={handleReport}
      title="Report bug"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      Report
    </button>
  );
};

const ToastItem = (props: ToastItemProps) => {
  const [local, rest] = splitProps(props, ["class", "id", "message", "subtitle", "variant", "source", "onClick"]);
  const isError = () => local.variant === "error";

  return (
    <div
      data-slot="toast"
      role="alert"
      class={cn(toastVariants({ variant: local.variant }), local.onClick && "cursor-pointer", local.class)}
      onClick={() => {
        if (local.onClick) {
          local.onClick();
          dismissToast(local.id);
        } else if (!isError()) {
          dismissToast(local.id);
        }
      }}
      {...rest}
    >
      <p>{local.message}</p>
      <Show when={local.subtitle}>
        <p class={`mt-0.5 text-xs text-muted-foreground ${local.onClick ? "underline" : ""}`}>{local.subtitle}</p>
      </Show>
      <Show when={isError()}>
        <div class="mt-1.5 flex items-center justify-end gap-1">
          <CopyButton text={local.message} />
          <Show when={local.source !== "plugin"}>
            <ReportButton message={local.message} toastId={local.id} />
          </Show>
        </div>
      </Show>
    </div>
  );
};

export const ToastContainer = () => {
  return (
    <Portal mount={document.body}>
      <div class="fixed right-4 top-4 z-70 flex flex-col gap-2 md:bottom-4 md:top-auto md:flex-col-reverse">
        <For each={toasts}>{(toast) => <ToastItem {...toast} />}</For>
      </div>
    </Portal>
  );
};
