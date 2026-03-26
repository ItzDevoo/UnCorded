import { createEffect, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import type { ServerId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { channelCacheLoading } from "../lib/gateway-store.js";
import {
  selectedServerId,
  setSelectedServerId,
  selectedChannelId,
} from "../stores/app-store.js";
import ChatArea from "../components/ChatArea.js";
import { Empty } from "../components/ui/empty.js";

const ServerView = () => {
  const params = useParams<{ serverId: string }>();
  const navigate = useNavigate();

  // Auto-select server from URL param
  createEffect(() => {
    const id = params.serverId as ServerId;
    if (id && selectedServerId() !== id) {
      setSelectedServerId(id);
    }
  });

  const hasServer = () =>
    readyData.data?.servers.some((s) => s.id === params.serverId) ?? false;

  const isLoadingChannels = () =>
    channelCacheLoading() === (params.serverId as ServerId);

  return (
    <Show
      when={hasServer() && selectedChannelId()}
      fallback={
        <Show
          when={hasServer()}
          fallback={
            <Empty
              title="Server not found"
              description="You may not be a member of this server."
            >
              <button
                type="button"
                onClick={() => navigate("/home")}
                class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                &larr; Back to Home
              </button>
            </Empty>
          }
        >
          <Show
            when={!isLoadingChannels()}
            fallback={
              <div class="flex flex-1 items-center justify-center">
                <div class="flex animate-fade-in flex-col items-center gap-3">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p class="text-muted-foreground">Loading channels...</p>
                </div>
              </div>
            }
          >
            <Empty
              title="No channels"
              description="This server has no channels yet."
            />
          </Show>
        </Show>
      }
    >
      <ChatArea />
    </Show>
  );
};

export default ServerView;
