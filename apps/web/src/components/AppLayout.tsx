import { onCleanup, createEffect, Show, type ParentComponent } from "solid-js";
import { useSession } from "../lib/auth.js";
import { connectGateway, disconnectGateway } from "../lib/gateway.js";
import { gatewayStatus } from "../lib/gateway-store.js";
import { selectedServerId } from "../stores/app-store.js";
import AuthGuard from "./AuthGuard.js";
import ServerSidebar from "./ServerSidebar.js";
import ChannelSidebar from "./ChannelSidebar.js";
import ChatArea from "./ChatArea.js";

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
      <div class="flex h-screen overflow-hidden">
        <ServerSidebar />
        <ChannelSidebar />
        <main class="flex min-w-0 flex-1 flex-col bg-bg-tertiary">
          <Show
            when={gatewayStatus() === "connected"}
            fallback={
              <div class="flex flex-1 items-center justify-center">
                <Show
                  when={gatewayStatus() === "connecting"}
                  fallback={<p class="text-text-muted">Disconnected from gateway</p>}
                >
                  <div class="flex flex-col items-center gap-3">
                    <div class="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <p class="text-text-muted">Connecting...</p>
                  </div>
                </Show>
              </div>
            }
          >
            <Show when={selectedServerId()} fallback={props.children}>
              <ChatArea />
            </Show>
          </Show>
        </main>
      </div>
    </AuthGuard>
  );
};

export default AppLayout;
