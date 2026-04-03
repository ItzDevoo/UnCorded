import { createSignal, Show } from "solid-js";
import {
  browserNotificationsEnabled,
  setBrowserNotifications,
} from "../../stores/notification-store.js";
import { requestPermission } from "../../lib/browser-notifications.js";

const NotificationSettings = () => {
  const [permissionState, setPermissionState] = createSignal(
    "Notification" in window ? Notification.permission : "default",
  );

  async function handleRequestPermission() {
    const granted = await requestPermission();
    setPermissionState(Notification.permission);
    if (granted) setBrowserNotifications(true);
  }

  return (
    <div class="space-y-8">
      {/* Browser notifications toggle */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Browser Notifications
        </h3>
        <div class="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
          <div>
            <p class="text-sm font-medium text-foreground">Enable browser notifications</p>
            <p class="text-xs text-muted-foreground">
              Show system notifications for new messages when UnCorded is in the background
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={browserNotificationsEnabled()}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
            classList={{
              "bg-primary": browserNotificationsEnabled(),
              "bg-muted": !browserNotificationsEnabled(),
            }}
            onClick={() => setBrowserNotifications(!browserNotificationsEnabled())}
          >
            <span
              class="pointer-events-none block h-5 w-5 rounded-full bg-foreground shadow-sm transition-transform"
              classList={{
                "translate-x-5": browserNotificationsEnabled(),
                "translate-x-0": !browserNotificationsEnabled(),
              }}
            />
          </button>
        </div>
      </div>

      {/* Permission status */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Permission Status
        </h3>
        <div class="rounded-md border border-border bg-card px-4 py-3">
          <Show when={permissionState() === "granted"}>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                Allowed
              </span>
              <span class="text-sm text-muted-foreground">Browser notifications are permitted</span>
            </div>
          </Show>

          <Show when={permissionState() === "denied"}>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                  Blocked
                </span>
                <span class="text-sm text-muted-foreground">
                  Notifications are blocked by your browser
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                To re-enable, open your browser's site settings for this page and allow
                notifications.
              </p>
            </div>
          </Show>

          <Show when={permissionState() === "default"}>
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Not asked
                </span>
                <span class="text-sm text-muted-foreground">
                  Browser hasn't been asked for permission yet
                </span>
              </div>
              <Show when={browserNotificationsEnabled()}>
                <button
                  type="button"
                  class="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={handleRequestPermission}
                >
                  Request Permission
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
