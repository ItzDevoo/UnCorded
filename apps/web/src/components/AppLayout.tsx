import { onCleanup, createEffect, Show, type ParentComponent } from "solid-js";
import { useSession } from "../lib/auth.js";
import { connectGateway, disconnectGateway } from "../lib/gateway.js";
import { gatewayStatus } from "../lib/gateway-store.js";
import { selectedServerId, selectedDmChannelId } from "../stores/app-store.js";
import "../lib/gateway-errors.js";
import AuthGuard from "./AuthGuard.js";
import AppSidebar from "./AppSidebar.js";
import ChatArea from "./ChatArea.js";
import { ToastContainer } from "./ui/toast.js";

const AppLayout: ParentComponent = (props) => {
  const session = useSession();

  createEffect(() => {
    const s = session();
    if (s.data?.session?.token && gatewayStatus() === "disconnected") {
      connectGateway(s.data.session.token);
    }
  });

  onCleanup(() => disconnectGateway());

  return (
    <AuthGuard>
      <ToastContainer />
      <div class="flex h-screen overflow-hidden">
        <AppSidebar />
        <main class="flex min-w-0 flex-1 flex-col bg-secondary">
          <Show
            when={gatewayStatus() === "connected"}
            fallback={
              <div class="flex flex-1 items-center justify-center">
                <Show
                  when={gatewayStatus() === "connecting"}
                  fallback={<p class="text-muted-foreground">Disconnected from gateway</p>}
                >
                  <div class="flex flex-col items-center gap-3">
                    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p class="text-muted-foreground">Connecting...</p>
                  </div>
                </Show>
              </div>
            }
          >
            <Show when={selectedServerId() || selectedDmChannelId()} fallback={props.children}>
              <ChatArea />
            </Show>
          </Show>
        </main>
      </div>
    </AuthGuard>
  );
};

export default AppLayout;
