import { createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";
import { showToast } from "./toast.js";
import { Tooltip } from "./tooltip.js";

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
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    <circle cx="16" cy="8" r="1.5" />
    <path d="M9 11.5L3.5 17" />
    <path d="M14 6.5l-1 4.5" />
  </svg>
);

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
  const visible = () => !!bridge() && VISIBLE_STATUSES.has(status());
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

  const colorClasses = (): string => {
    const s = status();
    if (s === "available") return "text-amber-500 animate-pulse";
    if (s === "downloading") return "text-sky-400 animate-update-pulse";
    if (s === "downloaded") return "text-emerald-500";
    return "text-muted-foreground";
  };

  const interactivityClasses = (): string => {
    if (isDownloading()) return "cursor-not-allowed opacity-60";
    return "hover:bg-accent hover:text-foreground";
  };

  return (
    <Show when={visible()}>
      <Tooltip content={label()} side="bottom">
        <button
          type="button"
          aria-label={label()}
          disabled={isDownloading()}
          class={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${colorClasses()} ${interactivityClasses()}`}
          style={{ "-webkit-app-region": "no-drag" }}
          onClick={handleClick}
        >
          <RocketIcon class="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </Show>
  );
};
