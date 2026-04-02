import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Rocket } from "lucide-solid";
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

const bridge = () => window.desktopBridge;

export const UpdatePill = () => {
  const [state, setState] = createSignal<UpdateState | null>(null);
  const [acting, setActing] = createSignal(false);

  onMount(() => {
    if (!bridge()) return;
    bridge()!
      .getUpdateState()
      .then((s) => setState(s as UpdateState))
      .catch(() => {});
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
          class={`ml-auto inline-flex size-7 items-center justify-center rounded-md transition-colors ${colorClasses()} ${interactivityClasses()}`}
          style={{ "-webkit-app-region": "no-drag" }}
          onClick={handleClick}
        >
          <Rocket class="size-3.5" />
        </button>
      </Tooltip>
    </Show>
  );
};
