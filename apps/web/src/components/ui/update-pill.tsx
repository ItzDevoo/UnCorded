import { createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";
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

const RocketIcon = (props: { class?: string }): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class={props.class}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {/* Rocket body */}
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    {/* Window */}
    <circle cx="16" cy="8" r="1.5" />
    {/* Fins */}
    <path d="M9 11.5L3.5 17" />
    <path d="M14 6.5l-1 4.5" />
  </svg>
);

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
            ? "bg-primary/15 text-primary cursor-default"
            : "bg-primary/15 text-primary cursor-pointer hover:bg-primary/22"
        }`}
        style={{ "-webkit-app-region": "no-drag" }}
        onClick={handleClick}
      >
        <RocketIcon
          class={`h-3.5 w-3.5 shrink-0 ${isDownloading() ? "animate-update-pulse" : ""}`}
        />

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
