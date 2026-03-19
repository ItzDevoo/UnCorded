import { For } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import { cn } from "../../lib/cn.js";

type ToastVariant = "info" | "error";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

const [toasts, setToasts] = createStore<Toast[]>([]);

const TOAST_AUTO_DISMISS_MS = 5_000;
let nextId = 0;
const timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();

export function showToast(message: string, variant: ToastVariant = "info"): void {
  const id = String(++nextId);
  setToasts(produce((arr) => arr.push({ id, message, variant })));
  const timeoutId = setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS);
  timeoutIds.set(id, timeoutId);
}

function dismissToast(id: string): void {
  const timeoutId = timeoutIds.get(id);
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
    timeoutIds.delete(id);
  }
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

export const ToastContainer = () => {
  return (
    <Portal mount={document.body}>
      <div class="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
        <For each={toasts}>
          {(toast) => (
            <div
              role="alert"
              class={cn(
                "rounded-lg border px-4 py-3 text-sm shadow-sm cursor-pointer select-none animate-fade-in",
                toast.variant === "error"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-card-foreground",
              )}
              onClick={() => dismissToast(toast.id)}
            >
              {toast.message}
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
};
