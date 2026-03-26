import { createEffect, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import type { UserId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { selectDmChannel, selectedDmChannelId } from "../stores/app-store.js";
import { fetchMoreDms, loadingMoreDms } from "../stores/friend-store.js";
import ChatArea from "../components/ChatArea.js";
import { Empty } from "../components/ui/empty.js";

const DirectMessage = () => {
  const params = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const userId = () => params.userId as UserId;

  const findDm = () =>
    readyData.data?.dmChannels.find((d) => d.otherUser.id === userId());

  // Auto-select the DM channel matching the URL userId
  createEffect(() => {
    const dm = findDm();
    if (dm && selectedDmChannelId() !== dm.id) {
      selectDmChannel(dm.id);
    }
  });

  // If DM not in loaded slice but more pages exist, fetch them
  createEffect(() => {
    if (!findDm() && readyData.data?.hasMoreDmChannels && !loadingMoreDms()) {
      fetchMoreDms();
    }
  });

  const isLoading = () =>
    !findDm() && (loadingMoreDms() || (readyData.data?.hasMoreDmChannels ?? false));

  const hasDm = () => findDm() !== undefined;

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="flex flex-1 items-center justify-center">
          <div class="flex animate-fade-in flex-col items-center gap-3">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p class="text-muted-foreground">Loading conversation...</p>
          </div>
        </div>
      }
    >
      <Show
        when={hasDm()}
        fallback={
          <Empty
            title="Conversation not found"
            description="This DM doesn't exist or hasn't started yet."
          >
            <button
              type="button"
              onClick={() => navigate("/messages")}
              class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              &larr; Back to Messages
            </button>
          </Empty>
        }
      >
        <ChatArea />
      </Show>
    </Show>
  );
};

export default DirectMessage;
