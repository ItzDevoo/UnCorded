/**
 * In-memory notification queue for plugin notifications.
 * Electron main process polls /notifications/pending to drain and display them.
 */

export interface PluginNotification {
  pluginId: string;
  title: string;
  body: string;
  level: "info" | "warning" | "error";
  timestamp: number;
}

const queue: PluginNotification[] = [];

export const notificationQueue = {
  push(notification: PluginNotification): void {
    queue.push(notification);
  },

  drain(): PluginNotification[] {
    return queue.splice(0, queue.length);
  },
};
