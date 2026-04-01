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

const VISIBLE_STATUSES = new Set(["available", "downloading", "downloaded"]);

export const UpdatePill = () => {
  const [state, setState] = createSignal<UpdateState | null>(null);
  const [acting, setActing] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);

  const bridge = () => window.desktopBridge;

  onMount(() => {
    if (!bridge()) return;
    bridge()!.getUpdateState().then((s) => setState(s as UpdateState)).catch(() => {});
    const unsub = bridge()!.onUpdateState((s: unknown) => setState(s as UpdateState));
    onCleanup(unsub);
  });

  const status = () => state()?.status ?? "idle";
  const visible = () => !!bridge() && !dismissed() && VISIBLE_STATUSES.has(status());
  const isDownloading = () => status() === "downloading";

  const handleClick = async () => {
    if (acting() || isDownloading()) return;
    setActing(true);
    try {
      if (status() === "available") {
        await bridge()!.downloadUpdate();
        showToast("Downloading update...", "info");
      } else if (status() === "downloaded") {
        showToast("Restarting to update...", "info");
        await bridge()!.installUpdate();
      }
    } catch {
      showToast("Update action failed", "error");
    } finally {
      setActing(false);
    }
  };

  const label = (): string => {
    const s = status();
    if (s === "available") return "Update available";
    if (s === "downloading") {
      const pct = state()?.downloadPercent;
      return pct != null ? `Downloading (${Math.round(pct)}%)` : "Downloading...";
    }
    if (s === "downloaded") return "Restart to update";
    return "";
  };

  return (
    <Show when={visible()}>
      <div
        class={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors ${
          isDownloading() || acting()
            ? "bg-primary/15 text-primary opacity-60 cursor-default"
            : "bg-primary/15 text-primary cursor-pointer hover:bg-primary/22"
        }`}
        style={{ "-webkit-app-region": "no-drag" }}
        onClick={handleClick}
      >
        {/* Icon */}
        <Show when={status() === "available" || status() === "downloading"}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class={`h-3.5 w-3.5 shrink-0 ${isDownloading() ? "animate-pulse" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </Show>
        <Show when={status() === "downloaded"}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Show>

        {/* Label */}
        <span class="whitespace-nowrap">{label()}</span>

        {/* Dismiss button — only for "available" state */}
        <Show when={status() === "available"}>
          <button
            type="button"
            class="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-primary/20"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Show>
      </div>
    </Show>
  );
};
