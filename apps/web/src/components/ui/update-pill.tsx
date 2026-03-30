import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { showToast } from "./toast.js";

interface UpdateState {
  enabled: boolean;
  status: string;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  message: string | null;
  errorContext: string | null;
  canRetry: boolean;
}

const HIDDEN_STATUSES = new Set(["idle", "up-to-date", "disabled", ""]);

export const UpdatePill = () => {
  const [state, setState] = createSignal<UpdateState | null>(null);
  const [acting, setActing] = createSignal(false);

  const bridge = () => window.desktopBridge;

  onMount(() => {
    if (!bridge()) return;

    bridge()!.getUpdateState().then((s) => setState(s as UpdateState)).catch(() => {});

    const unsub = bridge()!.onUpdateState((s: unknown) => setState(s as UpdateState));
    onCleanup(unsub);
  });

  const status = () => state()?.status ?? "idle";
  const visible = () => !!bridge() && !HIDDEN_STATUSES.has(status());

  const tooltip = (): string => {
    const s = state();
    if (!s) return "";
    switch (s.status) {
      case "available": return `Update ${s.availableVersion ?? ""} available`;
      case "downloading": return `Downloading ${s.downloadPercent != null ? `${Math.round(s.downloadPercent)}%` : "..."}`;
      case "downloaded": return "Restart to update";
      case "checking": return "Checking for updates";
      case "error": return s.message ?? "Update error";
      default: return "";
    }
  };

  const handleClick = async () => {
    if (acting()) return;
    const s = status();
    setActing(true);
    try {
      if (s === "available") {
        await bridge()!.downloadUpdate();
      } else if (s === "downloaded") {
        showToast("Restarting to update...", "info");
        await bridge()!.installUpdate();
      } else if (s === "error") {
        await bridge()!.checkForUpdates();
      }
    } catch {
      showToast("Update action failed", "error");
    } finally {
      setActing(false);
    }
  };

  const isClickable = () => {
    const s = status();
    return s === "available" || s === "downloaded" || s === "error";
  };

  return (
    <Show when={visible()}>
      <button
        type="button"
        class={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
          status() === "error"
            ? "bg-destructive/15 text-destructive hover:bg-destructive/22"
            : "bg-primary/15 text-primary hover:bg-primary/22"
        } ${!isClickable() || acting() ? "opacity-60 cursor-default" : "cursor-pointer"}`}
        title={tooltip()}
        onClick={handleClick}
        disabled={!isClickable() || acting()}
      >
        <Show when={status() === "available"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </Show>
        <Show when={status() === "downloading"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </Show>
        <Show when={status() === "downloaded"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Show>
        <Show when={status() === "checking"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Show>
        <Show when={status() === "error"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </Show>
      </button>
    </Show>
  );
};
