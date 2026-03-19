import { createStore } from "solid-js/store";
import { createEffect, createMemo, createRoot } from "solid-js";
import { Opcode } from "@uncorded/protocol";
import type { AnyChannelId, DmChannelId } from "@uncorded/protocol";
import {
  channelId,
  messageCreateEventSchema,
  fileShareEventSchema,
  fileAvailabilityEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { readyData } from "../lib/gateway-store.js";
import { selectedDmChannelId, selectedChannelId, selectDmChannel } from "./app-store.js";
import { showToast, dismissToast } from "../components/ui/toast.js";
import {
  initBrowserNotifications,
  requestPermission,
  showBrowserNotification,
} from "../lib/browser-notifications.js";

// ── Store ────────────────────────────────────────────────────────────────────

interface NotificationStoreState {
  unread: Record<string, number>;
}

const [store, setStore] = createStore<NotificationStoreState>({ unread: {} });

// ── Public API ───────────────────────────────────────────────────────────────

export function getUnreadCount(chId: AnyChannelId): number {
  return store.unread[chId as string] ?? 0;
}

export function hasUnread(chId: AnyChannelId): boolean {
  return getUnreadCount(chId) > 0;
}

export function markRead(chId: AnyChannelId): void {
  if (store.unread[chId as string]) {
    setStore("unread", chId as string, 0);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function incrementUnread(chId: string): void {
  setStore("unread", chId, (prev) => (prev ?? 0) + 1);
}

function isActiveChannel(chId: string): boolean {
  return chId === (selectedDmChannelId() as string) || chId === (selectedChannelId() as string);
}

function resolveSenderName(senderId: string): string {
  const dm = readyData.data?.dmChannels.find((d) => d.otherUser.id === senderId);
  if (dm) return dm.otherUser.displayName ?? dm.otherUser.username ?? "Someone";

  const friend = readyData.data?.friends.find((f) => f.userId === senderId);
  if (friend) return friend.displayName ?? friend.username ?? "Someone";

  return "Someone";
}

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "file";
  return fileName.slice(dot).toLowerCase();
}

function findDmChannelBySender(senderId: string): string | null {
  const dm = readyData.data?.dmChannels.find((d) => d.otherUser.id === senderId);
  return dm?.id ?? null;
}

let permissionRequested = false;

function notifyBrowser(title: string, body: string): void {
  if (!permissionRequested) {
    permissionRequested = true;
    requestPermission().then((granted) => {
      if (granted) showBrowserNotification(title, body);
    });
  } else {
    showBrowserNotification(title, body);
  }
}

// ── Subscriptions ────────────────────────────────────────────────────────────

let unsubMessage: (() => void) | null = null;
let unsubFile: (() => void) | null = null;
let unsubFileAvailability: (() => void) | null = null;
let disposeEffects: (() => void) | null = null;
const DEFAULT_TITLE = "UnCorded";

function teardown(): void {
  unsubMessage?.();
  unsubFile?.();
  unsubFileAvailability?.();
  disposeEffects?.();
  unsubMessage = null;
  unsubFile = null;
  unsubFileAvailability = null;
  disposeEffects = null;
  document.title = DEFAULT_TITLE;
}

export function setupNotificationStore(): void {
  teardown();
  initBrowserNotifications();

  unsubMessage = onGatewayEvent(Opcode.MESSAGE_CREATE, (data) => {
    const parsed = messageCreateEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    const chId = channelId(d.channelId) as string;

    // Skip self-messages
    if (d.author.id === readyData.data?.user.id) return;
    // Skip if user is viewing this channel
    if (isActiveChannel(chId)) return;

    incrementUnread(chId);

    const name = d.author.displayName ?? d.author.username ?? "Someone";
    showToast(`New message from ${name}`, "info");
    notifyBrowser(`UnCorded — ${name}`, d.content ?? "Shared a file");
  });

  unsubFile = onGatewayEvent(Opcode.FILE_SHARE, (data) => {
    const parsed = fileShareEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    const chId = channelId(d.channelId) as string;

    // Skip self-shares
    if (d.senderId === readyData.data?.user.id) return;
    // Skip if user is viewing this channel
    if (isActiveChannel(chId)) return;

    incrementUnread(chId);

    const name = resolveSenderName(d.senderId);
    const ext = getFileExtension(d.fileName);
    const dmChId = findDmChannelBySender(d.senderId);
    showToast(`${name} is sending a ${ext}`, "info", {
      id: `file-${d.fileReceiptId}`,
      subtitle: "Click to view file",
      durationMs: 60_000,
      onClick: dmChId
        ? () => selectDmChannel(dmChId as DmChannelId)
        : undefined,
    });
    notifyBrowser(`UnCorded — ${name}`, `Sending a ${ext} file`);
  });

  // Dismiss file share toast when sender goes offline
  unsubFileAvailability = onGatewayEvent(Opcode.FILE_AVAILABILITY_UPDATE, (data) => {
    const parsed = fileAvailabilityEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;

    // When a seeder goes offline, dismiss the file share toast
    if (!d.available) {
      dismissToast(`file-${d.fileReceiptId}`);
    }
  });

  // Reactive mark-as-read + document title
  disposeEffects = createRoot((dispose) => {
    createEffect(() => {
      const dmId = selectedDmChannelId();
      if (dmId) markRead(dmId);
    });

    createEffect(() => {
      const chId = selectedChannelId();
      if (chId) markRead(chId);
    });

    const totalUnread = createMemo(() => {
      let total = 0;
      for (const key of Object.keys(store.unread)) {
        total += store.unread[key] ?? 0;
      }
      return total;
    });

    createEffect(() => {
      const total = totalUnread();
      document.title = total > 0 ? `(${total}) UnCorded` : "UnCorded";
    });

    return dispose;
  });
}

// ── HMR cleanup ──────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
