import { createSignal } from "solid-js";
import {
  registerShortcut,
  unregisterShortcut,
  initShortcutListener,
  teardownShortcutListener,
} from "../lib/shortcuts.js";
import {
  selectedChannelId,
  setSelectedChannelId,
  currentChannels,
  setShowMembers,
} from "./app-store.js";

const [shortcutsDialogOpen, setShortcutsDialogOpen] = createSignal(false);

function setupShortcuts(): void {
  initShortcutListener();

  registerShortcut("help-question", {
    key: "?",
    description: "Open keyboard shortcuts",
    category: "General",
    handler: () => setShortcutsDialogOpen((v) => !v),
  });

  registerShortcut("help-ctrl-slash", {
    key: "/",
    ctrl: true,
    description: "Open keyboard shortcuts",
    category: "General",
    handler: () => setShortcutsDialogOpen((v) => !v),
  });

  registerShortcut("toggle-members", {
    key: "m",
    ctrl: true,
    shift: true,
    description: "Toggle member list",
    category: "Navigation",
    handler: () => setShowMembers((v) => !v),
  });

  registerShortcut("channel-up", {
    key: "arrowup",
    alt: true,
    description: "Previous channel",
    category: "Navigation",
    handler: () => {
      const channels = currentChannels();
      const current = selectedChannelId();
      if (channels.length === 0) return;
      const idx = channels.findIndex((c) => c.id === current);
      const prev = idx > 0 ? idx - 1 : channels.length - 1;
      const channel = channels[prev];
      if (channel) setSelectedChannelId(channel.id);
    },
  });

  registerShortcut("channel-down", {
    key: "arrowdown",
    alt: true,
    description: "Next channel",
    category: "Navigation",
    handler: () => {
      const channels = currentChannels();
      const current = selectedChannelId();
      if (channels.length === 0) return;
      const idx = channels.findIndex((c) => c.id === current);
      const next = idx < channels.length - 1 ? idx + 1 : 0;
      const channel = channels[next];
      if (channel) setSelectedChannelId(channel.id);
    },
  });

  registerShortcut("escape", {
    key: "Escape",
    description: "Close dialog",
    category: "General",
    handler: () => {
      if (shortcutsDialogOpen()) setShortcutsDialogOpen(false);
    },
  });
}

function cleanupShortcuts(): void {
  unregisterShortcut("help-question");
  unregisterShortcut("help-ctrl-slash");
  unregisterShortcut("toggle-members");
  unregisterShortcut("channel-up");
  unregisterShortcut("channel-down");
  unregisterShortcut("escape");
  teardownShortcutListener();
}

export { shortcutsDialogOpen, setShortcutsDialogOpen, setupShortcuts, cleanupShortcuts };
