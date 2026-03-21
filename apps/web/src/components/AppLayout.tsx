import {
  onCleanup,
  onMount,
  createEffect,
  Show,
  type ParentComponent,
} from "solid-js";
import { useSession } from "../lib/auth.js";
import { useLocation } from "@solidjs/router";
import { connectGateway, disconnectGateway } from "../lib/gateway.js";
import { gatewayStatus } from "../lib/gateway-store.js";
import { selectedServerId, selectedDmChannelId } from "../stores/app-store.js";
import { setupShortcuts, cleanupShortcuts } from "../stores/shortcut-store.js";
import "../lib/gateway-errors.js";
import "../stores/server-store.js";
import AuthGuard from "./AuthGuard.js";
import AppSidebar from "./AppSidebar.js";
import ChatArea from "./ChatArea.js";
import ShortcutsDialog from "./ShortcutsDialog.js";
import { ToastContainer } from "./ui/toast.js";
import { Empty } from "./ui/empty.js";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar.js";
import P2PNoticeDialog from "./P2PNoticeDialog.js";
import GiftNotification from "./modals/GiftNotification.js";
import { getP2pDialogOpen, confirmP2pDialog, cancelP2pDialog } from "../stores/file-store.js";

const SETTINGS_PATHS = ["/home/server-settings", "/home/settings"];

const AppLayout: ParentComponent = (props) => {
  const session = useSession();
  const location = useLocation();
  const isSettingsPage = () => SETTINGS_PATHS.some((p) => location.pathname.startsWith(p));

  createEffect(() => {
    const s = session();
    if (s.data?.session && gatewayStatus() === "disconnected") {
      connectGateway();
    }
  });

  onMount(() => setupShortcuts());
  onCleanup(() => {
    disconnectGateway();
    cleanupShortcuts();
  });

  return (
    <AuthGuard>
      <ToastContainer />
      <ShortcutsDialog />
      <GiftNotification />
      <P2PNoticeDialog
        open={getP2pDialogOpen()}
        onConfirm={confirmP2pDialog}
        onCancel={cancelP2pDialog}
      />
      <SidebarProvider class="h-screen !min-h-0">
        <AppSidebar />
        <SidebarInset>
          {/* Mobile header with sidebar trigger */}
          <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 md:hidden">
            <SidebarTrigger />
            <span class="text-sm font-semibold text-foreground">UnCorded</span>
          </div>

          <Show
            when={gatewayStatus() === "connected"}
            fallback={
              <div class="flex flex-1 items-center justify-center">
                <Show
                  when={gatewayStatus() === "connecting"}
                  fallback={
                    <Empty
                      title="Connection lost"
                      description="Trying to reconnect..."
                      icon={
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="1.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                          />
                        </svg>
                      }
                    />
                  }
                >
                  <div class="flex animate-fade-in flex-col items-center gap-3">
                    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p class="text-muted-foreground">Connecting to UnCorded...</p>
                  </div>
                </Show>
              </div>
            }
          >
            <Show
              when={!isSettingsPage() && (selectedServerId() || selectedDmChannelId())}
              fallback={<div class="flex-1 overflow-y-auto">{props.children}</div>}
            >
              <ChatArea />
            </Show>
          </Show>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
};

export default AppLayout;
