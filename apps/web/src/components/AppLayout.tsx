import { onCleanup, createEffect, Show, type ParentComponent } from "solid-js";
import { useSession } from "../lib/auth.js";
import { connectGateway, disconnectGateway } from "../lib/gateway.js";
import { gatewayStatus } from "../lib/gateway-store.js";
import { selectedServerId, selectedDmChannelId } from "../stores/app-store.js";
import "../lib/gateway-errors.js";
import "../stores/server-store.js";
import AuthGuard from "./AuthGuard.js";
import AppSidebar from "./AppSidebar.js";
import ChatArea from "./ChatArea.js";
import { ToastContainer } from "./ui/toast.js";
import { Empty } from "./ui/empty.js";

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
                  fallback={
                    <Empty
                      title="Connection lost"
                      description="Trying to reconnect..."
                      icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
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
