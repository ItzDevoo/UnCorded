import {
  onCleanup,
  onMount,
  createEffect,
  createSignal,
  Show,
  on,
  type ParentComponent,
} from "solid-js";
import { useSession } from "../lib/auth.js";
import { connectGateway, disconnectGateway, cancelReconnect } from "../lib/gateway.js";
import { gatewayStatus } from "../lib/gateway-store.js";
import { setupShortcuts, cleanupShortcuts } from "../stores/shortcut-store.js";
import "../lib/gateway-errors.js";
import "../stores/server-store.js";
import AuthGuard from "./AuthGuard.js";
import AppSidebar from "./AppSidebar.js";
import ShortcutsDialog from "./ShortcutsDialog.js";
import { ToastContainer, showToast } from "./ui/toast.js";
import { SidebarProvider, SidebarInset } from "./ui/sidebar.js";
import P2PNoticeDialog from "./P2PNoticeDialog.js";
import GiftNotification from "./modals/GiftNotification.js";
import DeletionCountdown from "./modals/DeletionCountdown.js";
import VerificationBanner from "./VerificationBanner.js";
import { getP2pDialogOpen, confirmP2pDialog, cancelP2pDialog } from "../stores/file-store.js";
import { commandPaletteOpen, setCommandPaletteOpen } from "../stores/command-palette-store.js";
import {
  pendingInvite,
  joinSession,
  activeReceiverSessionId,
} from "../stores/share-session-store.js";
import { isDesktop, plugins } from "../stores/plugin-store.js";
import {
  setupPluginBridge,
  teardownPluginBridge,
  updateAllowedOrigins,
} from "../lib/plugin-bridge.js";
import FileReceiveModal from "./modals/FileReceiveModal.js";

const AppLayout: ParentComponent = (props) => {
  const session = useSession();
  const [showConnected, setShowConnected] = createSignal(false);
  let wasDisconnected = false;

  createEffect(() => {
    const s = session();
    if (s.data?.session && gatewayStatus() === "disconnected") {
      connectGateway();
    }
  });

  // Show "Connected" banner briefly when transitioning to connected
  createEffect(() => {
    const status = gatewayStatus();
    if (status === "connecting" || status === "disconnected") {
      wasDisconnected = true;
    }
    if (status === "connected" && wasDisconnected) {
      wasDisconnected = false;
      setShowConnected(true);
      setTimeout(() => setShowConnected(false), 2000);
    }
  });

  // Plugin bridge — only active in desktop app
  onMount(() => {
    if (isDesktop()) {
      setupPluginBridge();
    }
  });

  // Keep origin allowlist in sync with running plugins
  createEffect(() => {
    if (isDesktop()) {
      updateAllowedOrigins(plugins());
    }
  });

  onMount(() => {
    setupShortcuts();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commandPaletteOpen()) {
        e.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }

      // Skip Ctrl+K when focus is inside editable elements
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable ||
        target.closest("[contenteditable]")
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  onCleanup(() => {
    disconnectGateway();
    cleanupShortcuts();
    teardownPluginBridge();
  });

  // Show persistent toast for incoming file share invites
  createEffect(
    on(pendingInvite, (invite) => {
      if (!invite) return;
      const sizeKb =
        invite.fileSize < 1024 * 1024
          ? `${(invite.fileSize / 1024).toFixed(1)} KB`
          : `${(invite.fileSize / (1024 * 1024)).toFixed(1)} MB`;

      showToast(
        `${invite.senderDisplayName ?? invite.senderUsername} wants to share "${invite.fileName}" (${sizeKb})`,
        "info",
        {
          durationMs: 60_000,
          subtitle: "Click to join",
          onClick: () => joinSession(invite.sessionId),
        },
      );
    }),
  );

  return (
    <AuthGuard>
      <ToastContainer />
      <ShortcutsDialog />
      <GiftNotification />
      <DeletionCountdown />
      <P2PNoticeDialog
        open={getP2pDialogOpen()}
        onConfirm={confirmP2pDialog}
        onCancel={cancelP2pDialog}
      />
      <Show when={activeReceiverSessionId()}>
        <FileReceiveModal />
      </Show>
      <SidebarProvider class="h-screen !min-h-0">
        <AppSidebar />
        <SidebarInset>
          <VerificationBanner />
          <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Always render children so chat content persists during disconnects */}
            <div
              class="flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity"
              classList={{ "opacity-40 pointer-events-none": gatewayStatus() !== "connected" }}
            >
              {props.children}
            </div>

            {/* Overlay banners for connecting / disconnected states */}
            <Show when={gatewayStatus() !== "connected"}>
              <div class="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-warning/90 px-3 py-2 text-sm font-medium text-warning-foreground">
                <Show
                  when={gatewayStatus() === "connecting"}
                  fallback={
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                      <span>Connection lost — trying to reconnect...</span>
                      <button
                        type="button"
                        class="ml-2 rounded-md bg-warning-foreground/20 px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-warning-foreground/30"
                        onClick={() => {
                          cancelReconnect();
                          connectGateway();
                        }}
                      >
                        Retry
                      </button>
                    </>
                  }
                >
                  <div class="h-4 w-4 animate-spin rounded-full border-2 border-warning-foreground border-t-transparent" />
                  <span>Connecting to UnCorded...</span>
                </Show>
              </div>
            </Show>

            {/* Connected success banner — briefly shown after connection established */}
            <Show when={showConnected()}>
              <div class="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-success/90 px-3 py-2 text-sm font-medium text-success-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Connected to UnCorded</span>
              </div>
            </Show>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
};

export default AppLayout;
