let permissionState: NotificationPermission = "default";

export function initBrowserNotifications(): void {
  if (!("Notification" in window)) return;
  permissionState = Notification.permission;
}

export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (permissionState === "granted") return true;
  if (permissionState === "denied") return false;

  const result = await Notification.requestPermission();
  permissionState = result;
  return result === "granted";
}

export function showBrowserNotification(title: string, body: string): void {
  if (permissionState !== "granted") return;
  if (document.hasFocus()) return;

  const notification = new Notification(title, {
    body,
    icon: "/icon-192.png",
    tag: "uncorded-message",
  });

  notification.addEventListener("click", () => {
    window.focus();
    notification.close();
  });
}
